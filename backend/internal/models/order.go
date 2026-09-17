package models

import "github.com/pocketbase/pocketbase/core"

type OrderItem struct {
	Slug      string   `json:"slug"`
	Name      string   `json:"name"`
	UnitPrice float64  `json:"unitPrice"`
	Qty       int      `json:"qty"`
	Options   []string `json:"options"`
}

// Order is the domain representation of an "orders" record.
type Order struct {
	ID            string
	Status        string
	CustomerName  string
	CustomerEmail string
	CustomerPhone string
	Notes         string
	Items         []OrderItem
	Subtotal      float64
	Created       string
}

func (o *Order) ApplyToRecord(record *core.Record) {
	record.Set("status", o.Status)
	record.Set("customer_name", o.CustomerName)
	record.Set("customer_email", o.CustomerEmail)
	record.Set("customer_phone", o.CustomerPhone)
	record.Set("notes", o.Notes)
	record.Set("items", o.Items)
	record.Set("subtotal", o.Subtotal)
}

func OrderFromRecord(record *core.Record) (*Order, error) {
	var items []OrderItem
	if err := record.UnmarshalJSONField("items", &items); err != nil {
		return nil, err
	}

	return &Order{
		ID:            record.Id,
		Status:        record.GetString("status"),
		CustomerName:  record.GetString("customer_name"),
		CustomerEmail: record.GetString("customer_email"),
		CustomerPhone: record.GetString("customer_phone"),
		Notes:         record.GetString("notes"),
		Items:         items,
		Subtotal:      record.GetFloat("subtotal"),
		Created:       record.GetDateTime("created").String(),
	}, nil
}
