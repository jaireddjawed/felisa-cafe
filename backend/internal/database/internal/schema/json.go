package schema

// Storage shapes for JSON fields, referenced from pbgen.json's jsonTypes.
// These are persistence formats, not domain types: the repositories in
// internal/database convert them to and from internal/models. Changing a
// JSON tag here changes what is read from existing rows, so treat tags as
// part of the schema.

// ProductModifierListRef links a product to a cached Square modifier list,
// with the item-level selection limits Square allows per item. Nil limits
// mean "use the modifier list's own limits".
type ProductModifierListRef struct {
	SquareModifierListID string `json:"square_modifier_list_id"`
	MinSelected          *int64 `json:"min_selected,omitempty"`
	MaxSelected          *int64 `json:"max_selected,omitempty"`
}

// ModifierJSON is one Square catalog modifier inside a modifier list.
type ModifierJSON struct {
	SquareModifierID string `json:"square_modifier_id"`
	Name             string `json:"name"`
	PriceAmount      int64  `json:"price_amount"`
	Currency         string `json:"currency"`
	Ordinal          int64  `json:"ordinal"`
	HiddenOnline     bool   `json:"hidden_online,omitempty"`
}

// CartItemJSON is a cart line. It stores identifiers and quantities only;
// prices are resolved server-side every time the cart is read.
type CartItemJSON struct {
	LineID            string   `json:"line_id"`
	SquareVariationID string   `json:"square_variation_id"`
	SquareModifierIDs []string `json:"square_modifier_ids,omitempty"`
	Quantity          int64    `json:"quantity"`
	Note              string   `json:"note,omitempty"`
}

// OrderLineItemJSON is the immutable historical snapshot of a purchased line.
type OrderLineItemJSON struct {
	ProductID         string                  `json:"product_id,omitempty"`
	ProductSlug       string                  `json:"product_slug,omitempty"`
	ProductName       string                  `json:"product_name"`
	ProductCategory   string                  `json:"product_category,omitempty"`
	SquareVariationID string                  `json:"square_variation_id,omitempty"`
	VariationName     string                  `json:"variation_name,omitempty"`
	Quantity          int64                   `json:"quantity"`
	UnitPriceAmount   int64                   `json:"unit_price_amount"`
	TotalAmount       int64                   `json:"total_amount"`
	Modifiers         []OrderLineModifierJSON `json:"modifiers,omitempty"`
	Note              string                  `json:"note,omitempty"`
}

type OrderLineModifierJSON struct {
	SquareModifierID string `json:"square_modifier_id,omitempty"`
	Name             string `json:"name"`
	PriceAmount      int64  `json:"price_amount"`
}
