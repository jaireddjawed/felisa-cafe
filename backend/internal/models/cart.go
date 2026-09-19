package models

import "time"

// CartOwner identifies whose cart is being accessed: a signed-in user, or a
// guest holding an opaque cart token. Exactly one is set.
type CartOwner struct {
	UserID UserID
	Token  string
}

func (o CartOwner) IsZero() bool { return o.UserID == "" && o.Token == "" }

// Cart stores identifiers and quantities only. It never stores prices:
// those are resolved from the catalog each time the cart is priced.
type Cart struct {
	ID      CartID
	UserID  UserID
	Items   []CartItem
	Updated time.Time
}

type CartItem struct {
	LineID      string
	VariationID SquareVariationID
	ModifierIDs []SquareModifierID
	Quantity    int64
	Note        string
}

func (c Cart) ItemCount() int64 {
	var n int64
	for _, it := range c.Items {
		n += it.Quantity
	}
	return n
}
