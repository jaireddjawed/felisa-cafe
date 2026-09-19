package actions

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

	items := make([]models.OrderItem, 0, len(input.Items))
	var subtotal float64

	for _, in := range input.Items {
		record, err := e.App.FindFirstRecordByFilter("products", "slug = {:slug}", dbx.Params{"slug": in.Slug})
		if err != nil {
			return e.BadRequestError("unknown product: "+in.Slug, err)
		}

		product, err := models.ProductFromRecord(record)
		if err != nil {
			return e.InternalServerError("failed to read product", err)
		}

		items = append(items, models.OrderItem{
			Slug:      in.Slug,
			Name:      product.Name,
			UnitPrice: product.Price,
			Qty:       in.Qty,
			Options:   in.Options,
		})
		subtotal += product.Price * float64(in.Qty)
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

	collection, err := e.App.FindCollectionByNameOrId("orders")
	if err != nil {
		return e.InternalServerError("orders collection not configured", err)
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
