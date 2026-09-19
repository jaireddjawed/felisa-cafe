// Package orders owns the local order projection: who may see an order, and
// how Square's authoritative order/payment/fulfillment state is folded into
// the local record.
//
// An order only becomes paid when Square says so, either through a verified
// webhook or a direct read from the Orders API. The browser returning from
// Square's checkout page proves nothing and is only ever a hint to re-read.
package orders

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/services/eta"
	"felisa-cafe/backend/internal/tokens"
)

const (
	historyLimit = 50
	// refreshInterval throttles on-view refreshes from Square.
	refreshInterval = 10 * time.Second
	// reconcileWindow bounds how far back the reconciler looks.
	reconcileWindow = 48 * time.Hour
)

type Service struct {
	store  *database.Store
	square payments.Checkout // nil when Square is not configured
	eta    eta.Estimator
	log    *slog.Logger
	now    func() time.Time
}

func New(store *database.Store, square payments.Checkout, estimator eta.Estimator, log *slog.Logger) *Service {
	return &Service{store: store, square: square, eta: estimator, log: log, now: time.Now}
}

// Viewer is who is asking to see an order.
type Viewer struct {
	UserID      models.UserID // signed-in customer, if any
	AccessToken string        // guest order token, if any
}

// ListForUser returns a customer's order history, newest first.
func (s *Service) ListForUser(ctx context.Context, user models.UserID) ([]models.Order, error) {
	if user == "" {
		return nil, models.ErrNotFound
	}
	return s.store.Orders.ListByUser(ctx, user, historyLimit)
}

// GetForViewer returns an order if the viewer may see it, else
// models.ErrNotFound (never a distinct "forbidden", so order IDs can't be
// probed). Account orders are visible to their owner only; guest orders to
// holders of the order's access token. Knowing an order ID is not enough.
//
// If the order is still settling, it is first refreshed from Square, so a
// customer landing on the confirmation page before the webhook arrives
// still sees their verified payment.
func (s *Service) GetForViewer(ctx context.Context, id models.OrderID, v Viewer) (models.Order, error) {
	o, err := s.store.Orders.FindByID(ctx, id)
	if err != nil {
		return models.Order{}, err
	}
	if !CanView(o, v) {
		return models.Order{}, models.ErrNotFound
	}
	if s.square != nil && o.Square.OrderID != "" && !o.Status.IsTerminal() && s.now().Sub(o.LastSyncedAt) > refreshInterval {
		refreshCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
		defer cancel()
		if fresh, err := s.SyncFromSquare(refreshCtx, o.Square.OrderID); err == nil {
			o = fresh
		} else {
			s.log.Warn("order refresh from square failed; serving cached state", "order", o.ID, "error", err)
		}
	}
	return o, nil
}

func CanView(o models.Order, v Viewer) bool {
	if o.UserID != "" {
		return v.UserID == o.UserID
	}
	return tokens.Matches(o.AccessTokenHash, v.AccessToken)
}

// SyncFromSquare reads the order from Square and folds it into the local
// projection. Safe to call any number of times, concurrently, and with
// events in any order: it always applies Square's latest state, and a
// version check discards reads older than what is already stored.
//
// Returns models.ErrNotFound for Square orders that aren't ours (e.g.
// in-store POS orders).
func (s *Service) SyncFromSquare(ctx context.Context, id models.SquareOrderID) (models.Order, error) {
	if s.square == nil {
		return models.Order{}, payments.ErrNotConfigured
	}
	// Most webhook traffic is for in-store sales. Skip the Square round trip
	// unless the order is ours, or might be (a checkout whose payment link
	// response was lost, so we don't know its Square ID yet).
	if _, err := s.store.Orders.FindBySquareOrderID(ctx, id); errors.Is(err, models.ErrNotFound) {
		maybe, err := s.store.Orders.HasUnlinkedSince(ctx, s.now().Add(-reconcileWindow))
		if err != nil {
			return models.Order{}, err
		}
		if !maybe {
			return models.Order{}, models.ErrNotFound
		}
	} else if err != nil {
		return models.Order{}, err
	}

	state, err := s.square.GetOrder(ctx, id)
	if err != nil {
		return models.Order{}, err
	}

	var out models.Order
	err = s.store.RunInTx(ctx, func(tx *database.Store) error {
		o, err := tx.Orders.FindBySquareOrderID(ctx, id)
		if errors.Is(err, models.ErrNotFound) && state.ReferenceID != "" {
			// The payment link response may have been lost (timeout) before
			// we stored the Square order ID; our reference_id links them.
			o, err = tx.Orders.FindByID(ctx, models.OrderID(state.ReferenceID))
			if err == nil && o.Square.OrderID != "" && o.Square.OrderID != id {
				return models.ErrNotFound // reference collision: not this order
			}
		}
		if err != nil {
			return err
		}

		wasPaid := o.Status.IsPaid()
		if !Apply(&o, *state, s.now()) {
			out = o
			return nil
		}
		if !wasPaid && o.Status.InQueue() {
			// Just became paid: the ETA given at checkout assumed the queue at
			// that moment; re-estimate against the queue as of payment.
			if ready, err := s.eta.Estimate(ctx, o.Items); err == nil {
				o.EstimatedReadyAt = ready
			}
		}
		if err := tx.Orders.Save(ctx, &o); err != nil {
			return err
		}
		out = o
		return nil
	})
	if err != nil {
		return models.Order{}, fmt.Errorf("sync order %s: %w", id, err)
	}
	return out, nil
}

// Apply folds Square state into o and reports whether anything changed.
func Apply(o *models.Order, st payments.OrderState, now time.Time) bool {
	if st.Version < o.Square.OrderVersion {
		return false // stale read; we already have something newer
	}
	before := *o

	o.Square.OrderID = st.ID
	o.Square.OrderVersion = st.Version
	if st.PaymentID != "" {
		o.Square.PaymentID = st.PaymentID
	}
	if st.Total.Currency != "" && st.Total.Amount > 0 {
		o.Total, o.Tax = st.Total, st.Tax
	}

	status := ProjectStatus(st)
	// Square never un-pays an order; guard against a regressing projection.
	if o.Status.IsPaid() && status == models.OrderPendingPayment {
		status = o.Status
	}
	o.Status = status
	if status.IsPaid() && o.PaidAt.IsZero() {
		o.PaidAt = now
	}
	if status == models.OrderCompleted && o.CompletedAt.IsZero() {
		switch {
		case !st.PickedUpAt.IsZero():
			o.CompletedAt = st.PickedUpAt
		case !st.ClosedAt.IsZero():
			o.CompletedAt = st.ClosedAt
		default:
			o.CompletedAt = now
		}
	}

	changed := !ordersEqual(before, *o)
	if changed || now.Sub(o.LastSyncedAt) > refreshInterval {
		o.LastSyncedAt = now
		changed = true
	}
	return changed
}

// ProjectStatus maps Square's order + payment + pickup state onto ours.
func ProjectStatus(st payments.OrderState) models.OrderStatus {
	switch {
	case st.State == payments.OrderCanceled:
		return models.OrderCancelled
	case st.State == payments.OrderCompleted:
		return models.OrderCompleted
	case !st.FullyPaid:
		return models.OrderPendingPayment
	}
	switch st.Fulfillment {
	case payments.FulfillmentReserved:
		return models.OrderPreparing
	case payments.FulfillmentPrepared:
		return models.OrderReady
	case payments.FulfillmentCompleted:
		return models.OrderCompleted
	case payments.FulfillmentCanceled, payments.FulfillmentFailed:
		return models.OrderCancelled
	}
	return models.OrderPaid
}

func ordersEqual(a, b models.Order) bool {
	return a.Status == b.Status && a.Square == b.Square && a.Total == b.Total && a.Tax == b.Tax &&
		a.PaidAt.Equal(b.PaidAt) && a.CompletedAt.Equal(b.CompletedAt)
}

// Reconcile re-reads every recent unsettled order from Square. It covers
// webhooks that were never delivered (misconfiguration, downtime) and is
// run periodically by cron.
func (s *Service) Reconcile(ctx context.Context) (int, error) {
	if s.square == nil {
		return 0, nil
	}
	pending, err := s.store.Orders.ListUnsettled(ctx, s.now().Add(-reconcileWindow), 200)
	if err != nil {
		return 0, err
	}
	var synced int
	for _, o := range pending {
		if ctx.Err() != nil {
			return synced, ctx.Err()
		}
		if _, err := s.SyncFromSquare(ctx, o.Square.OrderID); err != nil {
			s.log.Warn("reconcile order failed", "order", o.ID, "square_order", o.Square.OrderID, "error", err)
			continue
		}
		synced++
	}
	return synced, nil
}
