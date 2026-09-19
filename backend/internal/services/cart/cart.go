// Package cart manages server-side carts for guests (identified by an
// opaque cart token) and signed-in customers.
//
// A cart stores only Square variation/modifier IDs and quantities. Names and
// prices are resolved from the catalog cache every time the cart is read, so
// nothing the browser sends is ever trusted as a price.
package cart

import (
	"context"
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/models"
)

const (
	MaxLines        = 30
	MaxLineQuantity = 20
	MaxNoteLength   = 200
)

var (
	// ErrInvalidItem: the requested item/options combination can't be sold.
	ErrInvalidItem = errors.New("invalid cart item")
	ErrLineMissing = errors.New("cart line not found")
	ErrCartFull    = errors.New("cart is full")
)

type Service struct {
	store *database.Store
}

func New(store *database.Store) *Service {
	return &Service{store: store}
}

// Priced is a cart resolved against the catalog.
type Priced struct {
	Cart     models.Cart
	Lines    []Line
	Subtotal models.Money
	// Valid is false if any line can no longer be purchased as-is; such
	// lines carry a Problem and are excluded from Subtotal.
	Valid bool
}

type Line struct {
	Item      models.CartItem
	Product   models.Product
	Variation models.ProductVariation
	Modifiers []models.Modifier
	UnitPrice models.Money
	Total     models.Money
	Problem   string
}

func (p Priced) IsEmpty() bool { return len(p.Cart.Items) == 0 }

// OrderItems snapshots the priced lines as order items (for an order, or to
// estimate preparation time).
func (priced Priced) OrderItems() []models.OrderItem {
	items := make([]models.OrderItem, len(priced.Lines))
	for i, l := range priced.Lines {
		mods := make([]models.OrderItemModifier, len(l.Modifiers))
		for j, m := range l.Modifiers {
			mods[j] = models.OrderItemModifier{ModifierID: m.SquareID, Name: m.Name, Price: m.Price}
		}
		items[i] = models.OrderItem{
			ProductID:     l.Product.ID,
			ProductSlug:   l.Product.Slug,
			ProductName:   l.Product.Name,
			Category:      l.Product.Category,
			VariationID:   l.Variation.SquareID,
			VariationName: l.Variation.Name,
			Quantity:      l.Item.Quantity,
			UnitPrice:     l.UnitPrice,
			Total:         l.Total,
			Modifiers:     mods,
			Note:          l.Item.Note,
		}
	}
	return items
}

// Get returns the owner's priced cart (empty if none exists).
func (s *Service) Get(ctx context.Context, owner models.CartOwner) (Priced, error) {
	c, err := s.load(ctx, s.store, owner)
	if err != nil {
		return Priced{}, err
	}
	return s.price(ctx, c)
}

type AddItem struct {
	VariationID models.SquareVariationID
	ModifierIDs []models.SquareModifierID
	Quantity    int64
	Note        string
}

// Add validates the selection against the catalog and adds it, merging
// with an identical existing line.
func (s *Service) Add(ctx context.Context, owner models.CartOwner, in AddItem) (Priced, error) {
	if in.Quantity < 1 || in.Quantity > MaxLineQuantity {
		return Priced{}, fmt.Errorf("%w: quantity must be between 1 and %d", ErrInvalidItem, MaxLineQuantity)
	}
	in.Note = strings.TrimSpace(in.Note)
	if len([]rune(in.Note)) > MaxNoteLength {
		return Priced{}, fmt.Errorf("%w: note is too long", ErrInvalidItem)
	}
	products, err := s.store.Products.FindByVariationIDs(ctx, []models.SquareVariationID{in.VariationID})
	if err != nil {
		return Priced{}, err
	}
	product, ok := products[in.VariationID]
	if !ok {
		return Priced{}, fmt.Errorf("%w: unknown item", ErrInvalidItem)
	}
	if _, err := ValidateSelection(product, in.VariationID, in.ModifierIDs); err != nil {
		return Priced{}, err
	}

	mods := slices.Clone(in.ModifierIDs)
	slices.Sort(mods)

	return s.mutate(ctx, owner, func(c *models.Cart) error {
		for i := range c.Items {
			it := &c.Items[i]
			if it.VariationID == in.VariationID && slices.Equal(it.ModifierIDs, mods) && it.Note == in.Note {
				it.Quantity = min(it.Quantity+in.Quantity, MaxLineQuantity)
				return nil
			}
		}
		if len(c.Items) >= MaxLines {
			return ErrCartFull
		}
		c.Items = append(c.Items, models.CartItem{
			LineID:      uuid.NewString(),
			VariationID: in.VariationID,
			ModifierIDs: mods,
			Quantity:    in.Quantity,
			Note:        in.Note,
		})
		return nil
	})
}

// SetQuantity changes a line's quantity; zero or less removes it.
func (s *Service) SetQuantity(ctx context.Context, owner models.CartOwner, lineID string, qty int64) (Priced, error) {
	if qty > MaxLineQuantity {
		return Priced{}, fmt.Errorf("%w: quantity must be at most %d", ErrInvalidItem, MaxLineQuantity)
	}
	return s.mutate(ctx, owner, func(c *models.Cart) error {
		i := slices.IndexFunc(c.Items, func(it models.CartItem) bool { return it.LineID == lineID })
		if i < 0 {
			return ErrLineMissing
		}
		if qty <= 0 {
			c.Items = slices.Delete(c.Items, i, i+1)
		} else {
			c.Items[i].Quantity = qty
		}
		return nil
	})
}

func (s *Service) Remove(ctx context.Context, owner models.CartOwner, lineID string) (Priced, error) {
	return s.SetQuantity(ctx, owner, lineID, 0)
}

func (s *Service) Clear(ctx context.Context, owner models.CartOwner) error {
	return s.store.Carts.Delete(ctx, owner)
}

// Merge moves a guest cart into a customer's cart (typically right after
// sign-in) and deletes the guest cart.
func (s *Service) Merge(ctx context.Context, guestToken string, user models.UserID) (Priced, error) {
	var merged models.Cart
	err := s.store.RunInTx(ctx, func(tx *database.Store) error {
		guestOwner := models.CartOwner{Token: guestToken}
		userOwner := models.CartOwner{UserID: user}
		guest, err := s.load(ctx, tx, guestOwner)
		if err != nil {
			return err
		}
		merged, err = s.load(ctx, tx, userOwner)
		if err != nil {
			return err
		}
		for _, g := range guest.Items {
			i := slices.IndexFunc(merged.Items, func(it models.CartItem) bool {
				return it.VariationID == g.VariationID && slices.Equal(it.ModifierIDs, g.ModifierIDs) && it.Note == g.Note
			})
			switch {
			case i >= 0:
				merged.Items[i].Quantity = min(merged.Items[i].Quantity+g.Quantity, MaxLineQuantity)
			case len(merged.Items) < MaxLines:
				merged.Items = append(merged.Items, g)
			}
		}
		if len(guest.Items) > 0 {
			if err := tx.Carts.Save(ctx, userOwner, &merged); err != nil {
				return err
			}
		}
		return tx.Carts.Delete(ctx, guestOwner)
	})
	if err != nil {
		return Priced{}, err
	}
	return s.price(ctx, merged)
}

func (s *Service) mutate(ctx context.Context, owner models.CartOwner, fn func(*models.Cart) error) (Priced, error) {
	if owner.IsZero() {
		return Priced{}, errors.New("cart owner required")
	}
	var c models.Cart
	err := s.store.RunInTx(ctx, func(tx *database.Store) error {
		var err error
		if c, err = s.load(ctx, tx, owner); err != nil {
			return err
		}
		if err := fn(&c); err != nil {
			return err
		}
		return tx.Carts.Save(ctx, owner, &c)
	})
	if err != nil {
		return Priced{}, err
	}
	return s.price(ctx, c)
}

func (s *Service) load(ctx context.Context, store *database.Store, owner models.CartOwner) (models.Cart, error) {
	c, err := store.Carts.FindByOwner(ctx, owner)
	if errors.Is(err, models.ErrNotFound) {
		return models.Cart{UserID: owner.UserID}, nil
	}
	return c, err
}

func (s *Service) price(ctx context.Context, c models.Cart) (Priced, error) {
	ids := make([]models.SquareVariationID, len(c.Items))
	for i, it := range c.Items {
		ids[i] = it.VariationID
	}
	products, err := s.store.Products.FindByVariationIDs(ctx, ids)
	if err != nil {
		return Priced{}, err
	}
	return Price(c, products), nil
}

// Price resolves every cart line against catalog products (keyed by
// variation ID). It is pure: the same cart and catalog always price the same.
func Price(c models.Cart, products map[models.SquareVariationID]models.Product) Priced {
	out := Priced{Cart: c, Valid: true}
	for _, it := range c.Items {
		line := Line{Item: it}
		product, ok := products[it.VariationID]
		if !ok {
			line.Problem = "This item is no longer available."
		} else {
			line.Product = product
			line.Variation, _ = product.Variation(it.VariationID)
			mods, err := ValidateSelection(product, it.VariationID, it.ModifierIDs)
			if err != nil {
				line.Problem = problemText(err)
			} else {
				line.Modifiers = mods
				unit := line.Variation.Price
				for _, m := range mods {
					if unit, err = unit.Add(m.Price); err != nil {
						line.Problem = "This item can't be priced."
						break
					}
				}
				line.UnitPrice = unit
				line.Total = unit.Times(it.Quantity)
			}
		}
		if line.Problem != "" {
			out.Valid = false
		} else if sum, err := out.Subtotal.Add(line.Total); err != nil {
			line.Problem = "This item uses a different currency."
			out.Valid = false
		} else {
			out.Subtotal = sum
		}
		out.Lines = append(out.Lines, line)
	}
	return out
}

// ValidateSelection checks that variationID belongs to a purchasable
// product and that modifierIDs is a legal choice under the product's
// modifier lists (right lists, no duplicates, min/max per list). It returns
// the resolved modifiers.
func ValidateSelection(p models.Product, variationID models.SquareVariationID, modifierIDs []models.SquareModifierID) ([]models.Modifier, error) {
	if !p.Purchasable() {
		return nil, fmt.Errorf("%w: %s is not available", ErrInvalidItem, p.Name)
	}
	v, ok := p.Variation(variationID)
	if !ok || !v.Sellable {
		return nil, fmt.Errorf("%w: that option of %s is not available", ErrInvalidItem, p.Name)
	}

	chosen := map[models.SquareModifierID]bool{}
	for _, id := range modifierIDs {
		if chosen[id] {
			return nil, fmt.Errorf("%w: duplicate option", ErrInvalidItem)
		}
		chosen[id] = true
	}

	var mods []models.Modifier
	for _, pml := range p.ModifierLists {
		var n int64
		for _, m := range pml.List.Modifiers {
			if chosen[m.SquareID] && !m.HiddenOnline {
				mods = append(mods, m)
				delete(chosen, m.SquareID)
				n++
			}
		}
		if n < pml.MinSelected {
			return nil, fmt.Errorf("%w: choose at least %d %s", ErrInvalidItem, pml.MinSelected, strings.ToLower(pml.List.Name))
		}
		if pml.MaxSelected > 0 && n > pml.MaxSelected {
			return nil, fmt.Errorf("%w: choose at most %d %s", ErrInvalidItem, pml.MaxSelected, strings.ToLower(pml.List.Name))
		}
	}
	if len(chosen) > 0 {
		return nil, fmt.Errorf("%w: option not offered for %s", ErrInvalidItem, p.Name)
	}
	return mods, nil
}

func problemText(err error) string {
	msg := strings.TrimPrefix(err.Error(), ErrInvalidItem.Error()+": ")
	if msg == "" {
		return "This item is no longer available."
	}
	return strings.ToUpper(msg[:1]) + msg[1:] + "."
}
