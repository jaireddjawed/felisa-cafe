// Package paymentstest provides an in-memory fake of the payments
// interfaces that mimics the Square behaviours the app relies on:
// idempotent order creation, catalog-priced orders, and orders whose
// state is changed out-of-band (payment, fulfillment).
package paymentstest

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

type Fake struct {
	mu sync.Mutex

	Catalog payments.CatalogSnapshot

	// Errors to inject.
	FetchErr, LookupErr, CreateErr, GetErr error
	// TimeoutAfterCreate makes the next CreateOrder succeed "remotely"
	// but return ErrUnavailable to the caller, like a response lost to a
	// timeout.
	TimeoutAfterCreate bool

	orders     map[models.SquareOrderID]*payments.OrderState
	created    map[string]models.SquareOrderID
	Requests   []payments.OrderRequest
	Payments   []payments.PaymentRequest
	CreateHits int // distinct Square orders actually created
	GetCalls   int
	seq        int
}

var (
	_ payments.Catalog  = (*Fake)(nil)
	_ payments.Checkout = (*Fake)(nil)
	_ payments.Webhooks = (*Fake)(nil)
)

func New() *Fake {
	return &Fake{
		orders:  map[models.SquareOrderID]*payments.OrderState{},
		created: map[string]models.SquareOrderID{},
	}
}

func (f *Fake) FetchCatalog(context.Context) (*payments.CatalogSnapshot, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.FetchErr != nil {
		return nil, f.FetchErr
	}
	snap := f.Catalog
	return &snap, nil
}

func (f *Fake) LookupPrices(_ context.Context, vars []models.SquareVariationID, mods []models.SquareModifierID) (*payments.PriceCheck, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.LookupErr != nil {
		return nil, f.LookupErr
	}
	check := &payments.PriceCheck{
		Variations: map[models.SquareVariationID]payments.LiveVariation{},
		Modifiers:  map[models.SquareModifierID]payments.LiveModifier{},
	}
	for _, it := range f.Catalog.Items {
		for _, v := range it.Variations {
			for _, want := range vars {
				if v.SquareID == want {
					check.Variations[want] = payments.LiveVariation{ItemID: it.ID, Price: v.Price, Sellable: v.Sellable && it.Available}
				}
			}
		}
	}
	for _, ml := range f.Catalog.ModifierLists {
		for _, m := range ml.Modifiers {
			for _, want := range mods {
				if m.SquareID == want {
					check.Modifiers[want] = payments.LiveModifier{Price: m.Price, Available: true}
				}
			}
		}
	}
	return check, nil
}

func (f *Fake) CreateOrder(_ context.Context, req payments.OrderRequest) (*payments.OrderState, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Requests = append(f.Requests, req)
	if f.CreateErr != nil {
		return nil, f.CreateErr
	}
	// Square replays the original result for a repeated idempotency key.
	if id, ok := f.created[req.IdempotencyKey]; ok {
		out := *f.orders[id]
		return &out, nil
	}

	f.seq++
	f.CreateHits++
	var total int64
	for _, l := range req.Lines {
		total += f.unitPrice(l) * l.Quantity
	}
	id := models.SquareOrderID(fmt.Sprintf("sq-order-%d", f.seq))
	state := &payments.OrderState{
		ID:          id,
		Version:     1,
		ReferenceID: string(req.LocalOrderID),
		State:       payments.OrderOpen,
		Total:       models.NewMoney(total, models.USD),
		Tax:         models.NewMoney(0, models.USD),
		Fulfillment: payments.FulfillmentProposed,
	}
	f.orders[id] = state
	f.created[req.IdempotencyKey] = id

	if f.TimeoutAfterCreate {
		f.TimeoutAfterCreate = false
		return nil, fmt.Errorf("fake: %w: context deadline exceeded", payments.ErrUnavailable)
	}
	out := *state
	return &out, nil
}

func (f *Fake) CreatePayment(_ context.Context, req payments.PaymentRequest) (*payments.PaymentResult, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.Payments = append(f.Payments, req)
	if f.CreateErr != nil {
		return nil, f.CreateErr
	}
	st, ok := f.orders[req.OrderID]
	if !ok {
		return nil, fmt.Errorf("fake: %w: order %s not found", payments.ErrRejected, req.OrderID)
	}
	st.FullyPaid = true
	st.PaymentID = "pay-" + string(req.OrderID)
	st.Total = models.NewMoney(req.Amount.Amount+req.Tip.Amount, req.Amount.Currency)
	st.Version++
	out := *st
	return &payments.PaymentResult{PaymentID: st.PaymentID, Order: out}, nil
}

func (f *Fake) unitPrice(l payments.OrderLine) int64 {
	var price int64
	for _, it := range f.Catalog.Items {
		for _, v := range it.Variations {
			if v.SquareID == l.VariationID {
				price += v.Price.Amount
			}
		}
	}
	for _, ml := range f.Catalog.ModifierLists {
		for _, m := range ml.Modifiers {
			for _, id := range l.ModifierIDs {
				if m.SquareID == id {
					price += m.Price.Amount
				}
			}
		}
	}
	return price
}

func (f *Fake) GetOrder(_ context.Context, id models.SquareOrderID) (*payments.OrderState, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.GetCalls++
	if f.GetErr != nil {
		return nil, f.GetErr
	}
	st, ok := f.orders[id]
	if !ok {
		return nil, fmt.Errorf("fake: %w: order %s not found", payments.ErrRejected, id)
	}
	out := *st
	return &out, nil
}

// Pay marks an order fully paid, as a completed Square payment would.
func (f *Fake) Pay(id models.SquareOrderID) {
	f.update(id, func(st *payments.OrderState) {
		st.FullyPaid = true
		st.PaymentID = "pay-" + string(id)
	})
}

// SetFulfillment moves the pickup fulfillment, as staff would in Square POS.
func (f *Fake) SetFulfillment(id models.SquareOrderID, state payments.FulfillmentState) {
	f.update(id, func(st *payments.OrderState) {
		st.Fulfillment = state
		if state == payments.FulfillmentCompleted {
			st.State = payments.OrderCompleted
		}
	})
}

// Order returns a copy of the fake's state for id.
func (f *Fake) Order(id models.SquareOrderID) payments.OrderState {
	f.mu.Lock()
	defer f.mu.Unlock()
	return *f.orders[id]
}

func (f *Fake) update(id models.SquareOrderID, fn func(*payments.OrderState)) {
	f.mu.Lock()
	defer f.mu.Unlock()
	st := f.orders[id]
	fn(st)
	st.Version++
}

// ValidSignature is the only signature the fake accepts.
const ValidSignature = "valid-signature"

// ParseWebhook accepts a JSON-encoded payments.WebhookEvent as the body.
func (f *Fake) ParseWebhook(_ context.Context, body []byte, signature string) (*payments.WebhookEvent, error) {
	if signature != ValidSignature {
		return nil, payments.ErrInvalidSignature
	}
	var ev payments.WebhookEvent
	if err := json.Unmarshal(body, &ev); err != nil {
		return nil, err
	}
	return &ev, nil
}
