package controllers

import (
	"fmt"
	"net/http"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/views"
)

type checkoutItemInput struct {
	Slug    string   `json:"slug"`
	Qty     int      `json:"qty"`
	Options []string `json:"options"`
}

type checkoutInput struct {
	CustomerName  string              `json:"customerName"`
	CustomerEmail string              `json:"customerEmail"`
	CustomerPhone string              `json:"customerPhone"`
	Notes         string              `json:"notes"`
	Items         []checkoutItemInput `json:"items"`
}

// Checkout handles POST /api/checkout. It re-prices every line item from the
// products collection rather than trusting client-sent prices, then writes
// the order directly via app.Save — which is why the "orders" collection has
// no public create rule of its own.
func Checkout(e *core.RequestEvent) error {
	var input checkoutInput
	if err := e.BindBody(&input); err != nil {
		return e.BadRequestError("invalid checkout payload", err)
	}

	if input.CustomerName == "" || input.CustomerEmail == "" {
		return e.BadRequestError("customerName and customerEmail are required", nil)
	}
	if len(input.Items) == 0 {
		return e.BadRequestError("order must include at least one item", nil)
	}

	collection, err := e.App.FindCollectionByNameOrId("orders")
	if err != nil {
		return e.InternalServerError("orders collection not configured", err)
	}

	items := make([]models.OrderItem, 0, len(input.Items))
	var subtotal float64

	for _, in := range input.Items {
		if in.Qty <= 0 {
			return e.BadRequestError("item quantity must be positive", nil)
		}

		product, err := e.App.FindFirstRecordByFilter("products", "slug = {:slug}", dbx.Params{"slug": in.Slug})
		if err != nil {
			return e.BadRequestError(fmt.Sprintf("unknown product: %s", in.Slug), err)
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

	record := core.NewRecord(collection)
	record.Set("status", "pending")
	record.Set("customer_name", input.CustomerName)
	record.Set("customer_email", input.CustomerEmail)
	record.Set("customer_phone", input.CustomerPhone)
	record.Set("notes", input.Notes)
	record.Set("items", items)
	record.Set("subtotal", subtotal)

	if err := e.App.Save(record); err != nil {
		return e.BadRequestError("failed to place order", err)
	}

	order, err := models.OrderFromRecord(record)
	if err != nil {
		return e.InternalServerError("failed to read order", err)
	}

	return e.JSON(http.StatusCreated, views.NewOrderView(order))
}
