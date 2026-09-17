package views

import (
	"fmt"

	"felisa-cafe/backend/internal/models"
)

type OrderItemView struct {
	Slug      string   `json:"slug"`
	Name      string   `json:"name"`
	UnitPrice float64  `json:"unitPrice"`
	Qty       int      `json:"qty"`
	Options   []string `json:"options"`
}

type OrderView struct {
	ID                string             `json:"id"`
	Status            models.OrderStatus `json:"status"`
	CustomerName      string             `json:"customerName"`
	CustomerEmail     string             `json:"customerEmail"`
	Items             []OrderItemView    `json:"items"`
	Subtotal          float64            `json:"subtotal"`
	SubtotalFormatted string             `json:"subtotalFormatted"`
	Created           string             `json:"created"`
}

func NewOrderView(o *models.Order) *OrderView {
	items := make([]OrderItemView, 0, len(o.Items))
	for _, it := range o.Items {
		items = append(items, OrderItemView{
			Slug:      it.Slug,
			Name:      it.Name,
			UnitPrice: it.UnitPrice,
			Qty:       it.Qty,
			Options:   it.Options,
		})
	}

	return &OrderView{
		ID:                o.ID,
		Status:            o.Status,
		CustomerName:      o.CustomerName,
		CustomerEmail:     o.CustomerEmail,
		Items:             items,
		Subtotal:          o.Subtotal,
		SubtotalFormatted: fmt.Sprintf("$%.2f", o.Subtotal),
		Created:           o.Created,
	}
}
