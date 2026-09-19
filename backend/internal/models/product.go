package models

import "time"

// ProductCategory groups products on the menu.
type ProductCategory string

const (
	CategorySignature ProductCategory = "signature"
	CategoryMatcha    ProductCategory = "matcha"
	CategoryPantry    ProductCategory = "pantry"
	CategoryMerch     ProductCategory = "merch"
)

var ProductCategories = []ProductCategory{CategorySignature, CategoryMatcha, CategoryPantry, CategoryMerch}

func ParseProductCategory(s string) (ProductCategory, bool) {
	for _, c := range ProductCategories {
		if string(c) == s {
			return c, true
		}
	}
	return "", false
}

// RequiresPreparation reports whether items in this category are made to
// order by a barista (and so occupy the prep queue), as opposed to being
// handed over off the shelf.
func (c ProductCategory) RequiresPreparation() bool {
	return c == CategorySignature || c == CategoryMatcha
}

// CatalogStatus tracks a cached product's state relative to Square.
type CatalogStatus string

const (
	// CatalogUnlinked: local metadata exists but no Square item has been
	// matched to it yet. Not sellable.
	CatalogUnlinked CatalogStatus = "unlinked"
	CatalogActive   CatalogStatus = "active"
	// CatalogArchived: archived in Square or not offered at our location.
	CatalogArchived CatalogStatus = "archived"
	// CatalogDeleted: no longer returned by Square. Kept (not hard-deleted)
	// so local metadata survives if the item is recreated.
	CatalogDeleted CatalogStatus = "deleted"
)

// Product is a cached Square catalog item plus locally-owned presentation
// metadata.
//
// Square owns: SquareItemID, Name, Description, Category, Status,
// Variations, ModifierLists. The catalog sync overwrites these.
//
// The app owns: Slug, Tagline, Ingredients, Size, Pour, Badge, SortOrder.
// They are edited in the PocketBase admin UI and never touched by sync
// (except Slug, which is derived from the name on first import).
type Product struct {
	ID            ProductID
	SquareItemID  SquareItemID
	SquareVersion int64
	Status        CatalogStatus
	SyncedAt      time.Time

	Name          string
	Description   string
	Category      ProductCategory
	Variations    []ProductVariation
	ModifierLists []ProductModifierList

	Slug        string
	Tagline     string
	Ingredients []string
	Size        string
	Pour        Pour
	Badge       string
	SortOrder   int64
}

// Pour holds the gradient stops for the illustrated glass on the storefront.
type Pour struct {
	Top    string
	Bottom string
}

// ProductVariation is a sellable variant of a product (e.g. "Espresso" vs
// "Matcha" base). Its Square ID is what goes on a Square order line.
type ProductVariation struct {
	SquareID      SquareVariationID
	SquareVersion int64
	Name          string
	Price         Money
	// Sellable is false for variable-priced variations or ones Square marks
	// unsellable; we can never charge for those online.
	Sellable bool
	Ordinal  int64
}

// ModifierList is a cached Square modifier list (e.g. "Milk").
type ModifierList struct {
	SquareID      SquareModifierListID
	SquareVersion int64
	Name          string
	// MinSelected/MaxSelected use normalized Square semantics: 0 means no
	// minimum / no maximum.
	MinSelected int64
	MaxSelected int64
	Modifiers   []Modifier
}

type Modifier struct {
	SquareID     SquareModifierID
	Name         string
	Price        Money
	Ordinal      int64
	HiddenOnline bool
}

// ProductModifierList is a modifier list as it applies to one product, with
// item-level selection overrides already resolved.
type ProductModifierList struct {
	List        ModifierList
	MinSelected int64
	MaxSelected int64
}

// Purchasable reports whether the product can currently be ordered.
func (p Product) Purchasable() bool {
	if p.Status != CatalogActive {
		return false
	}
	for _, v := range p.Variations {
		if v.Sellable {
			return true
		}
	}
	return false
}

func (p Product) Variation(id SquareVariationID) (ProductVariation, bool) {
	for _, v := range p.Variations {
		if v.SquareID == id {
			return v, true
		}
	}
	return ProductVariation{}, false
}

// FromPrice is the lowest sellable variation price ("from $8.50").
func (p Product) FromPrice() (Money, bool) {
	var best Money
	found := false
	for _, v := range p.Variations {
		if v.Sellable && (!found || v.Price.Amount < best.Amount) {
			best, found = v.Price, true
		}
	}
	return best, found
}
