package controllers

import (
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/views"
)

// Checkout handles POST /api/checkout. It re-prices every line item from the
// products collection rather than trusting client-sent prices, then writes
// the order directly via app.Save — which is why the "orders" collection has
// no public create rule of its own.
func Checkout(e *core.RequestEvent) error {
	var input views.CheckoutInput
	if err := e.BindBody(&input); err != nil {
		return e.BadRequestError("invalid checkout payload", err)
	}

	if err := input.Validate(); err != nil {
		return e.BadRequestError("invalid checkout payload", err)
	}

	collection, err := e.App.FindCollectionByNameOrId("orders")
	if err != nil {
		return e.InternalServerError("orders collection not configured", err)
	}

	items := make([]models.OrderItem, 0, len(input.Items))
	var subtotal float64

	for _, in := range input.Items {
		product, err := e.App.FindFirstRecordByFilter("products", "slug = {:slug}", dbx.Params{"slug": in.Slug})
		if err != nil {
			return e.BadRequestError("unknown product: "+in.Slug, err)
		}

		unitPrice := product.GetFloat("price")
		items = append(items, models.OrderItem{
			Slug:      in.Slug,
			Name:      product.GetString("name"),
			UnitPrice: unitPrice,
			Qty:       in.Qty,
			Options:   in.Options,
		})
		subtotal += unitPrice * float64(in.Qty)
	}

	order := &models.Order{
		Status:        models.OrderStatusPending,
		CustomerName:  input.CustomerName,
		CustomerEmail: input.CustomerEmail,
		CustomerPhone: input.CustomerPhone,
		Notes:         input.Notes,
		Items:         items,
		Subtotal:      subtotal,
	}

	record := core.NewRecord(collection)
	order.ApplyToRecord(record)

	if err := e.App.Save(record); err != nil {
		return e.BadRequestError("failed to place order", err)
	}

	order.ID = record.Id
	order.Created = record.GetDateTime("created").String()

	return e.JSON(http.StatusCreated, views.NewOrderView(order))
}
