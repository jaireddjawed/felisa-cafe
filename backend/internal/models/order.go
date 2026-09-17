package models

import "github.com/pocketbase/pocketbase/core"

// OrderStatus mirrors the "status" select field's options on the orders
// collection (see internal/migrations/1700000001_orders_collection.go).
type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusConfirmed OrderStatus = "confirmed"
	OrderStatusCompleted OrderStatus = "completed"
	OrderStatusCancelled OrderStatus = "cancelled"
)

type OrderItem struct {
	Slug      string   `json:"slug"`
	Name      string   `json:"name"`
	UnitPrice float64  `json:"unitPrice"`
	Qty       int      `json:"qty"`
	Options   []string `json:"options"`
}

// Order is the domain representation of an "orders" record. The `column`
// tags are read by applyToRecord/scanRecord (see record.go) to move data
// to and from the underlying PocketBase record. Created has no column tag:
// it comes from GetDateTime, which doesn't fit the plain
// Set/GetString/GetFloat/UnmarshalJSONField dispatch scanRecord does for
// tagged fields.
type Order struct {
	ID            string      `column:"id,primary_key"`
	Status        OrderStatus `column:"status"`
	CustomerName  string      `column:"customer_name"`
	CustomerEmail string      `column:"customer_email"`
	CustomerPhone string      `column:"customer_phone"`
	Notes         string      `column:"notes"`
	Items         []OrderItem `column:"items"`
	Subtotal      float64     `column:"subtotal"`
	Created       string
}

func (o *Order) ApplyToRecord(record *core.Record) {
	applyToRecord(record, o)
}

func OrderFromRecord(record *core.Record) (*Order, error) {
	o := &Order{Created: record.GetDateTime("created").String()}
	if err := scanRecord(record, o); err != nil {
		return nil, err
	}
	return o, nil
}
