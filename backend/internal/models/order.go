package models

import "time"

// OrderStatus is the local projection of the Square order/payment/
// fulfillment state. Square is authoritative; this is derived from it.
type OrderStatus string

const (
	// OrderPendingPayment: payment link created, no verified payment yet.
	OrderPendingPayment OrderStatus = "pending_payment"
	// OrderPaid: Square confirms the order is fully paid; waiting in queue.
	OrderPaid OrderStatus = "paid"
	// OrderPreparing: staff accepted the fulfillment in Square.
	OrderPreparing OrderStatus = "preparing"
	// OrderReady: fulfillment marked prepared, awaiting pickup.
	OrderReady     OrderStatus = "ready"
	OrderCompleted OrderStatus = "completed"
	OrderCancelled OrderStatus = "cancelled"
)

// InQueue reports whether the order occupies the preparation queue.
func (s OrderStatus) InQueue() bool {
	return s == OrderPaid || s == OrderPreparing
}

// IsPaid reports whether a verified payment exists for the order.
func (s OrderStatus) IsPaid() bool {
	switch s {
	case OrderPaid, OrderPreparing, OrderReady, OrderCompleted:
		return true
	}
	return false
}

func (s OrderStatus) IsTerminal() bool {
	return s == OrderCompleted || s == OrderCancelled
}

// Contact is who the order is for.
type Contact struct {
	Name  string
	Email string
	Phone string
}

// SquareOrderRefs are the identifiers needed to reconcile with Square.
type SquareOrderRefs struct {
	OrderID       SquareOrderID
	OrderVersion  int64
	PaymentLinkID string
	PaymentID     string
	CheckoutURL   string
}

// Order is the local record of a checkout. Items is an immutable snapshot:
// it stays historically correct after products are renamed or repriced.
type Order struct {
	ID       OrderID
	UserID   UserID // empty for guest orders
	Status   OrderStatus
	Customer Contact
	Notes    string

	Items    []OrderItem
	Subtotal Money
	Tax      Money
	Total    Money

	// IdempotencyKey is the client-supplied checkout key; retries with the
	// same key return this order instead of creating another.
	IdempotencyKey string
	// AccessTokenHash authorizes guest access to the order (SHA-256 of the
	// token handed to the guest at checkout).
	AccessTokenHash string

	Square SquareOrderRefs

	EstimatedReadyAt time.Time
	PaidAt           time.Time
	CompletedAt      time.Time
	LastSyncedAt     time.Time
	Created          time.Time
	Updated          time.Time
}

type OrderItem struct {
	ProductID     ProductID
	ProductSlug   string
	ProductName   string
	Category      ProductCategory
	VariationID   SquareVariationID
	VariationName string
	Quantity      int64
	UnitPrice     Money // variation + modifiers, per unit
	Total         Money
	Modifiers     []OrderItemModifier
	Note          string
}

type OrderItemModifier struct {
	ModifierID SquareModifierID
	Name       string
	Price      Money
}

// PrepUnits is the number of made-to-order items, the unit of work the
// ETA estimator schedules.
func PrepUnits(items []OrderItem) int64 {
	var n int64
	for _, it := range items {
		if it.Category.RequiresPreparation() {
			n += it.Quantity
		}
	}
	return n
}

// User is a registered customer account.
type User struct {
	ID    UserID
	Email string
	Name  string
	Phone string
}
