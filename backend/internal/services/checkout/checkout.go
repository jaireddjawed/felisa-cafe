// Package checkout turns a cart into a Square-hosted checkout.
//
//	cart --price from cache--> revalidate with Square --> local order (pending_payment)
//	     --> Square Order + payment link (idempotent) --> redirect to Square
//
// Payment is confirmed later, only by Square (see package orders).
//
// Failure handling:
//   - Client retries reuse the client's Idempotency-Key and get the same
//     local order back instead of a new one.
//   - The Square call's idempotency key is derived from the local order ID,
//     and the request is rebuilt from the persisted order snapshot, so a
//     retry after a timeout (request succeeded remotely, response lost)
//     returns the original Square order/link rather than creating a second.
//   - If Square can't be reached to confirm current prices, checkout is
//     refused; the cached menu is never used to charge a customer.
package checkout

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"
	"time"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/services/cart"
	"felisa-cafe/backend/internal/services/eta"
	"felisa-cafe/backend/internal/tokens"
)

var (
	ErrEmptyCart = errors.New("cart is empty")
	// ErrInvalidContact: required customer details are missing.
	ErrInvalidContact = errors.New("name and email are required")
	// ErrCartInvalid: some cart lines can no longer be purchased as-is.
	ErrCartInvalid = errors.New("cart has unavailable items")
	// ErrPricesChanged: Square's live catalog differs from our cache. The
	// cache is being refreshed; the customer should review the cart.
	ErrPricesChanged = errors.New("prices or availability changed")
	// ErrIdempotencyConflict: the idempotency key belongs to someone else's
	// checkout or to one that failed permanently.
	ErrIdempotencyConflict = errors.New("idempotency key already used")
	// ErrUnavailable: Square could not be reached. Safe to retry with the
	// same idempotency key.
	ErrUnavailable = errors.New("checkout temporarily unavailable")
	// ErrRejected: Square refused to create the checkout.
	ErrRejected = errors.New("checkout rejected by payment provider")
)

type Config struct {
	// PublicSiteURL is the storefront origin Square redirects back to.
	PublicSiteURL string
}

type Service struct {
	cfg     Config
	store   *database.Store
	carts   *cart.Service
	catalog payments.Catalog
	square  payments.Checkout
	eta     eta.Estimator
	// onStaleCatalog is called when Square disagrees with the cache.
	onStaleCatalog func()
	log            *slog.Logger
}

func New(cfg Config, store *database.Store, carts *cart.Service, catalog payments.Catalog, square payments.Checkout,
	estimator eta.Estimator, onStaleCatalog func(), log *slog.Logger) *Service {
	return &Service{cfg: cfg, store: store, carts: carts, catalog: catalog, square: square, eta: estimator, onStaleCatalog: onStaleCatalog, log: log}
}

type Request struct {
	Owner          models.CartOwner
	UserID         models.UserID // set when signed in
	Contact        models.Contact
	Notes          string
	IdempotencyKey string
}

type Result struct {
	Order       models.Order
	CheckoutURL string
	// AccessToken lets a guest view the order later. Only returned for guest
	// orders; only its hash is stored.
	AccessToken string
}

// Checkout validates the cart against Square and returns a hosted checkout
// URL. See the package doc for the idempotency guarantees.
func (s *Service) Checkout(ctx context.Context, req Request) (*Result, error) {
	if s.square == nil || s.catalog == nil {
		return nil, fmt.Errorf("%w: %w", ErrUnavailable, payments.ErrNotConfigured)
	}
	if len(req.IdempotencyKey) < 16 || len(req.IdempotencyKey) > 255 {
		return nil, fmt.Errorf("%w: idempotency key must be 16-255 characters", ErrIdempotencyConflict)
	}

	// 1. Replay: a retry of a checkout we've already started.
	existing, err := s.store.Orders.FindByIdempotencyKey(ctx, req.IdempotencyKey)
	switch {
	case err == nil:
		return s.resume(ctx, existing, req)
	case !errors.Is(err, models.ErrNotFound):
		return nil, err
	}

	// 2. Price the cart from the cache.
	priced, err := s.carts.Get(ctx, req.Owner)
	if err != nil {
		return nil, err
	}
	if priced.IsEmpty() {
		return nil, ErrEmptyCart
	}
	if !priced.Valid {
		return nil, ErrCartInvalid
	}

	// 3. Revalidate against Square: never charge from a stale cache.
	if err := s.revalidate(ctx, priced); err != nil {
		return nil, err
	}

	// 4. Contact details: signed-in customers default to their profile.
	contact := req.Contact
	if req.UserID != "" {
		if u, err := s.store.Users.FindByID(ctx, req.UserID); err == nil {
			contact.Name = orDefault(contact.Name, u.Name)
			contact.Email = orDefault(contact.Email, u.Email)
			contact.Phone = orDefault(contact.Phone, u.Phone)
		}
	}
	if strings.TrimSpace(contact.Name) == "" || strings.TrimSpace(contact.Email) == "" {
		return nil, ErrInvalidContact
	}

	// 5. Snapshot the order locally before talking to Square, so the Square
	//    request can reference it and be rebuilt identically on retry.
	items := priced.OrderItems()
	ready, err := s.eta.Estimate(ctx, items)
	if err != nil {
		return nil, fmt.Errorf("estimate: %w", err)
	}
	order := models.Order{
		UserID:           req.UserID,
		Status:           models.OrderPendingPayment,
		Customer:         contact,
		Notes:            req.Notes,
		Items:            items,
		Subtotal:         priced.Subtotal,
		Tax:              models.NewMoney(0, priced.Subtotal.Currency),
		Total:            priced.Subtotal,
		IdempotencyKey:   req.IdempotencyKey,
		EstimatedReadyAt: ready,
	}
	var accessToken string
	if req.UserID == "" {
		accessToken = tokens.New()
		order.AccessTokenHash = tokens.Hash(accessToken)
	}
	if err := s.store.Orders.Save(ctx, &order); err != nil {
		// Lost a race with a concurrent request using the same key.
		if prior, findErr := s.store.Orders.FindByIdempotencyKey(ctx, req.IdempotencyKey); findErr == nil {
			return s.resume(ctx, prior, req)
		}
		return nil, fmt.Errorf("save order: %w", err)
	}
	// Build the Square request from the stored row (not the in-memory copy)
	// so a retry, which can only see the stored row, sends identical bytes.
	if order, err = s.store.Orders.FindByID(ctx, order.ID); err != nil {
		return nil, err
	}

	res, err := s.createLink(ctx, order)
	if err != nil {
		return nil, err
	}
	res.AccessToken = accessToken

	// The order snapshot now holds the cart's contents.
	if err := s.carts.Clear(ctx, req.Owner); err != nil {
		s.log.Warn("clear cart after checkout failed", "order", order.ID, "error", err)
	}
	return res, nil
}

// resume continues a checkout found by idempotency key.
func (s *Service) resume(ctx context.Context, o models.Order, req Request) (*Result, error) {
	if o.UserID != req.UserID {
		return nil, ErrIdempotencyConflict
	}
	if o.Status == models.OrderCancelled && o.Square.OrderID == "" {
		return nil, fmt.Errorf("%w: that checkout failed; start a new one", ErrIdempotencyConflict)
	}

	var accessToken string
	if o.UserID == "" {
		// Only the hash was stored, so a guest retry gets a fresh token (the
		// previous response, and its token, were presumably lost).
		accessToken = tokens.New()
		err := s.store.RunInTx(ctx, func(tx *database.Store) error {
			cur, err := tx.Orders.FindByID(ctx, o.ID)
			if err != nil {
				return err
			}
			cur.AccessTokenHash = tokens.Hash(accessToken)
			if err := tx.Orders.Save(ctx, &cur); err != nil {
				return err
			}
			o = cur
			return nil
		})
		if err != nil {
			return nil, err
		}
	}

	if o.Square.CheckoutURL != "" {
		return &Result{Order: o, CheckoutURL: o.Square.CheckoutURL, AccessToken: accessToken}, nil
	}
	// No link stored: the earlier Square call failed or timed out.
	res, err := s.createLink(ctx, o)
	if err != nil {
		return nil, err
	}
	res.AccessToken = accessToken
	if err := s.carts.Clear(ctx, req.Owner); err != nil {
		s.log.Warn("clear cart after checkout failed", "order", o.ID, "error", err)
	}
	return res, nil
}

// createLink asks Square for the order + payment link and stores the result.
func (s *Service) createLink(ctx context.Context, o models.Order) (*Result, error) {
	link, err := s.square.CreatePaymentLink(ctx, s.linkRequest(o))
	if err != nil {
		if errors.Is(err, payments.ErrRejected) {
			// Definitive: this order can never be created as-is.
			o.Status = models.OrderCancelled
			if saveErr := s.store.Orders.Save(ctx, &o); saveErr != nil {
				s.log.Error("mark rejected checkout cancelled", "order", o.ID, "error", saveErr)
			}
			s.log.Warn("square rejected payment link", "order", o.ID, "error", err)
			return nil, fmt.Errorf("%w: %w", ErrRejected, err)
		}
		// Ambiguous: leave the order pending with no link. A retry with the
		// same client key rebuilds the identical Square request.
		s.log.Warn("payment link creation failed; retry is safe", "order", o.ID, "error", err)
		return nil, fmt.Errorf("%w: %w", ErrUnavailable, err)
	}

	var saved models.Order
	err = s.store.RunInTx(ctx, func(tx *database.Store) error {
		// Re-read: a webhook may already have linked and advanced this order.
		cur, err := tx.Orders.FindByID(ctx, o.ID)
		if err != nil {
			return err
		}
		cur.Square.PaymentLinkID = link.ID
		cur.Square.CheckoutURL = link.URL
		if cur.Square.OrderID == "" {
			cur.Square.OrderID = link.Order.ID
			cur.Square.OrderVersion = link.Order.Version
		}
		// Square computed the authoritative total (taxes, discounts).
		if link.Order.Total.Currency != "" && link.Order.Total.Amount > 0 {
			cur.Total, cur.Tax = link.Order.Total, link.Order.Tax
		}
		if err := tx.Orders.Save(ctx, &cur); err != nil {
			return err
		}
		saved = cur
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("store payment link: %w", err)
	}
	return &Result{Order: saved, CheckoutURL: link.URL}, nil
}

// linkRequest is a pure function of the persisted order, which is what
// makes retries with the same idempotency key safe.
func (s *Service) linkRequest(o models.Order) payments.PaymentLinkRequest {
	lines := make([]payments.PaymentLinkLine, len(o.Items))
	for i, it := range o.Items {
		mods := make([]models.SquareModifierID, len(it.Modifiers))
		for j, m := range it.Modifiers {
			mods[j] = m.ModifierID
		}
		lines[i] = payments.PaymentLinkLine{VariationID: it.VariationID, ModifierIDs: mods, Quantity: it.Quantity, Note: it.Note}
	}
	return payments.PaymentLinkRequest{
		IdempotencyKey: "felisa-order-" + string(o.ID),
		LocalOrderID:   o.ID,
		Lines:          lines,
		Customer:       o.Customer,
		Notes:          o.Notes,
		PrepTime:       max(o.EstimatedReadyAt.Sub(o.Created), time.Minute),
		RedirectURL:    strings.TrimRight(s.cfg.PublicSiteURL, "/") + "/orders/" + string(o.ID),
	}
}

// revalidate compares every priced line with Square's live catalog.
func (s *Service) revalidate(ctx context.Context, priced cart.Priced) error {
	var varIDs []models.SquareVariationID
	var modIDs []models.SquareModifierID
	for _, l := range priced.Lines {
		varIDs = append(varIDs, l.Variation.SquareID)
		for _, m := range l.Modifiers {
			modIDs = append(modIDs, m.SquareID)
		}
	}
	live, err := s.catalog.LookupPrices(ctx, varIDs, modIDs)
	if err != nil {
		if errors.Is(err, payments.ErrRejected) {
			return fmt.Errorf("verify prices: %w", err)
		}
		return fmt.Errorf("%w: could not verify current prices: %w", ErrUnavailable, err)
	}

	for _, l := range priced.Lines {
		v, ok := live.Variations[l.Variation.SquareID]
		stale := !ok || !v.Sellable || v.Price != l.Variation.Price
		for _, m := range l.Modifiers {
			lm, ok := live.Modifiers[m.SquareID]
			stale = stale || !ok || !lm.Available || lm.Price != m.Price
		}
		if stale {
			s.log.Info("cached catalog is stale; refreshing", "variation", l.Variation.SquareID)
			if s.onStaleCatalog != nil {
				s.onStaleCatalog()
			}
			return ErrPricesChanged
		}
	}
	return nil
}

func orDefault(v, fallback string) string {
	if strings.TrimSpace(v) != "" {
		return v
	}
	return fallback
}
