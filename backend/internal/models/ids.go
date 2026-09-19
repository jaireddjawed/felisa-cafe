package models

import "errors"

// Local (PocketBase) identifiers.
type (
	ProductID string
	CartID    string
	OrderID   string
	UserID    string
)

// Square identifiers. Distinct types so that, say, a modifier ID can never
// be passed where Square expects an item variation ID.
type (
	SquareItemID         string
	SquareVariationID    string
	SquareModifierListID string
	SquareModifierID     string
	SquareOrderID        string
)

// ErrNotFound is returned by repositories and services when an entity does
// not exist or the caller is not allowed to know it exists.
var ErrNotFound = errors.New("not found")
