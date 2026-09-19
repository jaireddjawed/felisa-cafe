package database

import (
	"context"
	"errors"
	"fmt"

	"felisa-cafe/backend/internal/database/internal/schema"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/tokens"
)

type CartRepo struct {
	carts table[schema.CartsRecord, *schema.CartsRecord]
}

// FindByOwner returns the owner's cart or models.ErrNotFound. Guest carts
// are looked up by the hash of their token; the raw token is never stored.
func (r CartRepo) FindByOwner(ctx context.Context, owner models.CartOwner) (models.Cart, error) {
	rec, err := r.findRecord(ctx, owner)
	if err != nil {
		return models.Cart{}, err
	}
	return cartFromRecord(rec)
}

// Save writes cart as owner's cart, creating it if needed. Sets cart.ID.
func (r CartRepo) Save(ctx context.Context, owner models.CartOwner, cart *models.Cart) error {
	rec, err := r.findRecord(ctx, owner)
	switch {
	case errors.Is(err, models.ErrNotFound):
		if rec, err = r.carts.New(); err != nil {
			return err
		}
		if owner.UserID != "" {
			rec.SetUser(schema.UsersID(owner.UserID))
		} else {
			rec.SetTokenHash(tokens.Hash(owner.Token))
		}
	case err != nil:
		return err
	}

	items := make([]schema.CartItemJSON, len(cart.Items))
	for i, it := range cart.Items {
		items[i] = schema.CartItemJSON{
			LineID:            it.LineID,
			SquareVariationID: string(it.VariationID),
			SquareModifierIDs: stringsOf(it.ModifierIDs),
			Quantity:          it.Quantity,
			Note:              it.Note,
		}
	}
	rec.SetItems(items)
	if err := r.carts.Save(ctx, rec); err != nil {
		return err
	}
	cart.ID = models.CartID(rec.ID())
	cart.UserID = models.UserID(rec.User())
	cart.Updated = rec.Updated()
	return nil
}

// Delete removes owner's cart, if any.
func (r CartRepo) Delete(ctx context.Context, owner models.CartOwner) error {
	rec, err := r.findRecord(ctx, owner)
	if errors.Is(err, models.ErrNotFound) {
		return nil
	}
	if err != nil {
		return err
	}
	return r.carts.Delete(ctx, rec)
}

func (r CartRepo) findRecord(ctx context.Context, owner models.CartOwner) (*schema.CartsRecord, error) {
	switch {
	case owner.UserID != "":
		return r.carts.Query().Where(schema.Carts.User.Eq(schema.UsersID(owner.UserID))).One(ctx)
	case owner.Token != "":
		return r.carts.Query().Where(schema.Carts.TokenHash.Eq(tokens.Hash(owner.Token))).One(ctx)
	}
	return nil, models.ErrNotFound
}

func cartFromRecord(rec *schema.CartsRecord) (models.Cart, error) {
	items, err := rec.Items()
	if err != nil {
		return models.Cart{}, fmt.Errorf("cart %s: %w", rec.ID(), err)
	}
	cart := models.Cart{ID: models.CartID(rec.ID()), UserID: models.UserID(rec.User()), Updated: rec.Updated()}
	for _, it := range items {
		mods := make([]models.SquareModifierID, len(it.SquareModifierIDs))
		for i, m := range it.SquareModifierIDs {
			mods[i] = models.SquareModifierID(m)
		}
		cart.Items = append(cart.Items, models.CartItem{
			LineID:      it.LineID,
			VariationID: models.SquareVariationID(it.SquareVariationID),
			ModifierIDs: mods,
			Quantity:    it.Quantity,
			Note:        it.Note,
		})
	}
	return cart, nil
}
