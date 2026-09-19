package square

import (
	"context"
	"fmt"
	"math"
	"strconv"
	"time"

	sq "github.com/square/square-go-sdk/v4"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

// CreateOrder creates a Square Order from catalog variation/modifier IDs, so
// Square, not us, prices every line and applies taxes.
//
// Square replays the original order for a repeated idempotency key with
// an identical body, so callers must derive the key from the local order and
// build the request from the persisted order snapshot.
func (c *Client) CreateOrder(ctx context.Context, req payments.OrderRequest) (*payments.OrderState, error) {
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	resp, err := c.sq.Orders.Create(ctx, &sq.CreateOrderRequest{
		Order:          c.orderRequest(req),
		IdempotencyKey: sq.String(req.IdempotencyKey),
	})
	if err != nil {
		return nil, classify("create order", err)
	}
	if err := errorsIn("create order", resp.Errors); err != nil {
		return nil, err
	}
	if resp.Order == nil || resp.Order.ID == nil {
		return nil, fmt.Errorf("square create order: %w: response missing order", payments.ErrUnavailable)
	}

	state := c.orderState(resp.Order)
	if state.ID == "" {
		state.ID = models.SquareOrderID(*resp.Order.ID)
	}
	return &state, nil
}

func (c *Client) orderRequest(req payments.OrderRequest) *sq.Order {
	lines := make([]*sq.OrderLineItem, len(req.Lines))
	for i, l := range req.Lines {
		mods := make([]*sq.OrderLineItemModifier, len(l.ModifierIDs))
		for j, m := range l.ModifierIDs {
			mods[j] = &sq.OrderLineItemModifier{CatalogObjectID: sq.String(string(m))}
		}
		line := &sq.OrderLineItem{
			Quantity:        strconv.FormatInt(l.Quantity, 10),
			CatalogObjectID: sq.String(string(l.VariationID)),
			Modifiers:       mods,
		}
		if l.Note != "" {
			line.Note = sq.String(l.Note)
		}
		lines[i] = line
	}

	recipient := &sq.FulfillmentRecipient{DisplayName: sq.String(req.Customer.Name)}
	if req.Customer.Email != "" {
		recipient.EmailAddress = sq.String(req.Customer.Email)
	}
	if req.Customer.Phone != "" {
		recipient.PhoneNumber = sq.String(req.Customer.Phone)
	}
	pickup := &sq.FulfillmentPickupDetails{
		Recipient:        recipient,
		ScheduleType:     sq.FulfillmentPickupDetailsScheduleTypeAsap.Ptr(),
		PrepTimeDuration: sq.String(isoMinutes(req.PrepTime)),
	}
	if req.Notes != "" {
		pickup.Note = sq.String(truncate(req.Notes, 500))
	}

	localID := string(req.LocalOrderID)
	return &sq.Order{
		LocationID:  c.cfg.LocationID,
		ReferenceID: sq.String(localID),
		LineItems:   lines,
		Fulfillments: []*sq.Fulfillment{{
			Type:          sq.FulfillmentTypePickup.Ptr(),
			State:         sq.FulfillmentStateProposed.Ptr(),
			PickupDetails: pickup,
		}},
		Metadata: map[string]*string{"local_order_id": sq.String(localID)},
		PricingOptions: &sq.OrderPricingOptions{
			AutoApplyTaxes:     sq.Bool(true),
			AutoApplyDiscounts: sq.Bool(true),
		},
	}
}

// CreatePayment charges a token produced by the Square Web Payments SDK.
func (c *Client) CreatePayment(ctx context.Context, req payments.PaymentRequest) (*payments.PaymentResult, error) {
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	payReq := &sq.CreatePaymentRequest{
		SourceID:       req.SourceID,
		IdempotencyKey: req.IdempotencyKey,
		AmountMoney:    moneyPtr(req.Amount),
		LocationID:     sq.String(c.cfg.LocationID),
		OrderID:        sq.String(string(req.OrderID)),
		Autocomplete:   sq.Bool(true),
		ReferenceID:    sq.String(string(req.LocalOrderID)),
		Note:           sq.String("Online order " + string(req.LocalOrderID)),
	}
	if req.Tip.Amount > 0 {
		payReq.TipMoney = moneyPtr(req.Tip)
	}
	if req.Customer.Email != "" {
		payReq.BuyerEmailAddress = sq.String(req.Customer.Email)
	}
	if req.Customer.Phone != "" {
		payReq.BuyerPhoneNumber = sq.String(req.Customer.Phone)
	}

	resp, err := c.sq.Payments.Create(ctx, payReq)
	if err != nil {
		return nil, classify("create payment", err)
	}
	if err := errorsIn("create payment", resp.Errors); err != nil {
		return nil, err
	}
	if resp.Payment == nil || resp.Payment.ID == nil {
		return nil, fmt.Errorf("square create payment: %w: response missing payment", payments.ErrUnavailable)
	}

	state, err := c.GetOrder(ctx, req.OrderID)
	if err != nil {
		return nil, err
	}
	return &payments.PaymentResult{PaymentID: deref(resp.Payment.ID), Order: *state}, nil
}

// GetOrder reads the authoritative order state.
func (c *Client) GetOrder(ctx context.Context, id models.SquareOrderID) (*payments.OrderState, error) {
	ctx, cancel := c.withTimeout(ctx)
	defer cancel()

	resp, err := c.sq.Orders.Get(ctx, &sq.GetOrdersRequest{OrderID: string(id)})
	if err != nil {
		return nil, classify("get order", err)
	}
	if err := errorsIn("get order", resp.Errors); err != nil {
		return nil, err
	}
	if resp.Order == nil {
		return nil, fmt.Errorf("square get order: %w: empty response", payments.ErrUnavailable)
	}
	state := c.orderState(resp.Order)
	return &state, nil
}

func (c *Client) orderState(o *sq.Order) payments.OrderState {
	st := payments.OrderState{
		ID:          models.SquareOrderID(deref(o.ID)),
		Version:     int64(deref(o.Version)),
		ReferenceID: deref(o.ReferenceID),
		State:       payments.OrderLifecycle(deref(o.State)),
		Total:       money(o.TotalMoney, c.cfg.Currency),
		Tax:         money(o.TotalTaxMoney, c.cfg.Currency),
		ClosedAt:    parseTime(o.ClosedAt),
		UpdatedAt:   parseTime(o.UpdatedAt),
	}

	// Paid means Square holds tenders covering the full amount due. Tenders
	// only appear on an order once the payment has been captured.
	var tendered int64
	for _, t := range o.Tenders {
		if t == nil {
			continue
		}
		if st.PaymentID == "" {
			st.PaymentID = deref(t.PaymentID)
		}
		tendered += deref(t.AmountMoney.GetAmount())
	}
	due := st.Total.Amount - tendered
	if o.NetAmountDueMoney != nil && o.NetAmountDueMoney.Amount != nil {
		due = *o.NetAmountDueMoney.Amount
	}
	st.FullyPaid = len(o.Tenders) > 0 && due <= 0 && st.State != payments.OrderCanceled

	for _, f := range o.Fulfillments {
		if f == nil || deref(f.Type) != sq.FulfillmentTypePickup {
			continue
		}
		st.Fulfillment = payments.FulfillmentState(deref(f.State))
		if d := f.PickupDetails; d != nil {
			st.PickupAt = parseTime(d.PickupAt)
			st.PickedUpAt = parseTime(d.PickedUpAt)
		}
		break
	}
	return st
}

// isoMinutes renders d as an RFC 3339 duration in whole minutes ("PT12M").
func isoMinutes(d time.Duration) string {
	return fmt.Sprintf("PT%dM", max(1, int64(math.Ceil(d.Minutes()))))
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func moneyPtr(m models.Money) *sq.Money {
	return &sq.Money{Amount: sq.Int64(m.Amount), Currency: sq.Currency(m.Currency).Ptr()}
}
