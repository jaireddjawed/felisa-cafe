package database

import (
	"context"
	"fmt"
	"time"

	"felisa-cafe/backend/internal/database/internal/schema"
	"felisa-cafe/backend/internal/models"
)

type OrderRepo struct {
	orders table[schema.OrdersRecord, *schema.OrdersRecord]
}

func (r OrderRepo) FindByID(ctx context.Context, id models.OrderID) (models.Order, error) {
	rec, err := r.orders.FindByID(ctx, string(id))
	if err != nil {
		return models.Order{}, err
	}
	return orderFromRecord(rec)
}

func (r OrderRepo) FindByIdempotencyKey(ctx context.Context, key string) (models.Order, error) {
	if key == "" {
		return models.Order{}, models.ErrNotFound
	}
	rec, err := r.orders.Query().Where(schema.Orders.IdempotencyKey.Eq(key)).One(ctx)
	if err != nil {
		return models.Order{}, err
	}
	return orderFromRecord(rec)
}

func (r OrderRepo) FindBySquareOrderID(ctx context.Context, id models.SquareOrderID) (models.Order, error) {
	if id == "" {
		return models.Order{}, models.ErrNotFound
	}
	rec, err := r.orders.Query().Where(schema.Orders.SquareOrderID.Eq(string(id))).One(ctx)
	if err != nil {
		return models.Order{}, err
	}
	return orderFromRecord(rec)
}

// ListByUser returns a customer's orders, newest first. Orders that never
// got as far as a Square checkout are omitted.
func (r OrderRepo) ListByUser(ctx context.Context, user models.UserID, limit int64) ([]models.Order, error) {
	recs, err := r.orders.Query().
		Where(
			schema.Orders.User.Eq(schema.UsersID(user)),
			schema.Orders.SquareOrderID.NotEq(""),
		).
		OrderBy(schema.Orders.Created.Desc()).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return ordersFromRecords(recs)
}

// ListInQueue returns paid orders still waiting for or being prepared, in
// the order they joined the queue.
func (r OrderRepo) ListInQueue(ctx context.Context) ([]models.Order, error) {
	recs, err := r.orders.Query().
		Where(schema.Orders.Status.In(schema.OrdersStatusPaid, schema.OrdersStatusPreparing)).
		OrderBy(schema.Orders.PaidAt.Asc(), schema.Orders.Created.Asc()).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return ordersFromRecords(recs)
}

// ListUnsettled returns orders created since `since` that have a Square
// order and are not in a terminal state: candidates for reconciliation
// against Square in case a webhook was missed.
func (r OrderRepo) ListUnsettled(ctx context.Context, since time.Time, limit int64) ([]models.Order, error) {
	recs, err := r.orders.Query().
		Where(
			schema.Orders.SquareOrderID.NotEq(""),
			schema.Orders.Status.In(
				schema.OrdersStatusPendingPayment, schema.OrdersStatusPaid,
				schema.OrdersStatusPreparing, schema.OrdersStatusReady,
			),
			schema.Orders.Created.Gte(since),
		).
		OrderBy(schema.Orders.Created.Asc()).
		Limit(limit).
		All(ctx)
	if err != nil {
		return nil, err
	}
	return ordersFromRecords(recs)
}

// HasUnlinkedSince reports whether any order created since `since` is
// still waiting for its Square order ID (its payment link response was lost).
func (r OrderRepo) HasUnlinkedSince(ctx context.Context, since time.Time) (bool, error) {
	return r.orders.Query().
		Where(
			schema.Orders.SquareOrderID.Eq(""),
			schema.Orders.Status.Eq(schema.OrdersStatusPendingPayment),
			schema.Orders.Created.Gte(since),
		).
		Exists(ctx)
}

// Save creates or updates o (by o.ID). Sets o.ID, o.Created and o.Updated.
func (r OrderRepo) Save(ctx context.Context, o *models.Order) error {
	var rec *schema.OrdersRecord
	var err error
	if o.ID == "" {
		rec, err = r.orders.New()
	} else {
		rec, err = r.orders.FindByID(ctx, string(o.ID))
	}
	if err != nil {
		return fmt.Errorf("order %s: %w", o.ID, err)
	}

	status, err := orderStatuses.ToDB(o.Status)
	if err != nil {
		return err
	}
	lines := make([]schema.OrderLineItemJSON, len(o.Items))
	for i, it := range o.Items {
		mods := make([]schema.OrderLineModifierJSON, len(it.Modifiers))
		for j, m := range it.Modifiers {
			mods[j] = schema.OrderLineModifierJSON{SquareModifierID: string(m.ModifierID), Name: m.Name, PriceAmount: m.Price.Amount}
		}
		lines[i] = schema.OrderLineItemJSON{
			ProductID:         string(it.ProductID),
			ProductSlug:       it.ProductSlug,
			ProductName:       it.ProductName,
			ProductCategory:   string(it.Category),
			SquareVariationID: string(it.VariationID),
			VariationName:     it.VariationName,
			Quantity:          it.Quantity,
			UnitPriceAmount:   it.UnitPrice.Amount,
			TotalAmount:       it.Total.Amount,
			Modifiers:         mods,
			Note:              it.Note,
		}
	}

	rec.SetUser(schema.UsersID(o.UserID))
	rec.SetStatus(status)
	rec.SetCustomerName(o.Customer.Name)
	rec.SetCustomerEmail(o.Customer.Email)
	rec.SetCustomerPhone(o.Customer.Phone)
	rec.SetNotes(o.Notes)
	rec.SetLineItems(lines)
	rec.SetCurrency(string(o.Total.Currency))
	rec.SetSubtotalAmount(o.Subtotal.Amount)
	rec.SetTaxAmount(o.Tax.Amount)
	rec.SetTotalAmount(o.Total.Amount)
	rec.SetIdempotencyKey(o.IdempotencyKey)
	rec.SetAccessTokenHash(o.AccessTokenHash)
	rec.SetSquareOrderID(string(o.Square.OrderID))
	rec.SetSquareOrderVersion(o.Square.OrderVersion)
	rec.SetSquarePaymentLinkID(o.Square.PaymentLinkID)
	rec.SetSquarePaymentID(o.Square.PaymentID)
	rec.SetCheckoutURL(o.Square.CheckoutURL)
	rec.SetEstimatedReadyAt(o.EstimatedReadyAt)
	rec.SetPaidAt(o.PaidAt)
	rec.SetCompletedAt(o.CompletedAt)
	rec.SetLastSyncedAt(o.LastSyncedAt)

	if err := r.orders.Save(ctx, rec); err != nil {
		return err
	}
	o.ID = models.OrderID(rec.ID())
	o.Created, o.Updated = rec.Created(), rec.Updated()
	return nil
}

func ordersFromRecords(recs []*schema.OrdersRecord) ([]models.Order, error) {
	out := make([]models.Order, 0, len(recs))
	for _, rec := range recs {
		o, err := orderFromRecord(rec)
		if err != nil {
			return nil, err
		}
		out = append(out, o)
	}
	return out, nil
}

func orderFromRecord(rec *schema.OrdersRecord) (models.Order, error) {
	status, err := orderStatuses.FromDB(rec.Status())
	if err != nil {
		return models.Order{}, fmt.Errorf("order %s: %w", rec.ID(), err)
	}
	lines, err := rec.LineItems()
	if err != nil {
		return models.Order{}, err
	}
	cur := models.Currency(rec.Currency())
	money := func(amount int64) models.Money { return models.NewMoney(amount, cur) }

	o := models.Order{
		ID:     models.OrderID(rec.ID()),
		UserID: models.UserID(rec.User()),
		Status: status,
		Customer: models.Contact{
			Name:  rec.CustomerName(),
			Email: rec.CustomerEmail(),
			Phone: rec.CustomerPhone(),
		},
		Notes:           rec.Notes(),
		Subtotal:        money(rec.SubtotalAmount()),
		Tax:             money(rec.TaxAmount()),
		Total:           money(rec.TotalAmount()),
		IdempotencyKey:  rec.IdempotencyKey(),
		AccessTokenHash: rec.AccessTokenHash(),
		Square: models.SquareOrderRefs{
			OrderID:       models.SquareOrderID(rec.SquareOrderID()),
			OrderVersion:  rec.SquareOrderVersion(),
			PaymentLinkID: rec.SquarePaymentLinkID(),
			PaymentID:     rec.SquarePaymentID(),
			CheckoutURL:   rec.CheckoutURL(),
		},
		EstimatedReadyAt: rec.EstimatedReadyAt(),
		PaidAt:           rec.PaidAt(),
		CompletedAt:      rec.CompletedAt(),
		LastSyncedAt:     rec.LastSyncedAt(),
		Created:          rec.Created(),
		Updated:          rec.Updated(),
	}
	for _, l := range lines {
		item := models.OrderItem{
			ProductID:     models.ProductID(l.ProductID),
			ProductSlug:   l.ProductSlug,
			ProductName:   l.ProductName,
			Category:      models.ProductCategory(l.ProductCategory),
			VariationID:   models.SquareVariationID(l.SquareVariationID),
			VariationName: l.VariationName,
			Quantity:      l.Quantity,
			UnitPrice:     money(l.UnitPriceAmount),
			Total:         money(l.TotalAmount),
			Note:          l.Note,
		}
		for _, m := range l.Modifiers {
			item.Modifiers = append(item.Modifiers, models.OrderItemModifier{
				ModifierID: models.SquareModifierID(m.SquareModifierID),
				Name:       m.Name,
				Price:      money(m.PriceAmount),
			})
		}
		o.Items = append(o.Items, item)
	}
	return o, nil
}
