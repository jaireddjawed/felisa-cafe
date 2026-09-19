package database

import (
	"context"
	"fmt"
	"slices"

	"github.com/pocketbase/dbx"
	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/database/internal/schema"
	"felisa-cafe/backend/internal/models"
)

type (
	productsTable      = table[schema.ProductsRecord, *schema.ProductsRecord]
	variationsTable    = table[schema.ProductVariationsRecord, *schema.ProductVariationsRecord]
	modifierListsTable = table[schema.ModifierListsRecord, *schema.ModifierListsRecord]
)

// ProductRepo persists the cached catalog. A models.Product is an aggregate
// of a products row, its product_variations rows and the modifier_lists it
// references; this repository reads and writes it as one unit.
type ProductRepo struct {
	products   productsTable
	variations variationsTable
	lists      modifierListsTable
}

func newProductRepo(app core.App) ProductRepo {
	return ProductRepo{products: productsTable{app}, variations: variationsTable{app}, lists: modifierListsTable{app}}
}

// ---------------------------------------------------------------------------
// Storefront reads
// ---------------------------------------------------------------------------

// ListByCategories returns active products in the given categories (all
// active products if none are given), in menu order.
func (r ProductRepo) ListByCategories(ctx context.Context, cats ...models.ProductCategory) ([]models.Product, error) {
	q := r.products.Query().
		Where(schema.Products.CatalogStatus.Eq(schema.ProductsCatalogStatusActive)).
		OrderBy(schema.Products.SortOrder.Asc(), schema.Products.Name.Asc())
	if len(cats) > 0 {
		dbCats, err := categories.AllToDB(cats)
		if err != nil {
			return nil, err
		}
		q.Where(schema.Products.Category.In(dbCats...))
	}
	recs, err := q.All(ctx)
	if err != nil {
		return nil, err
	}
	return r.hydrate(ctx, recs)
}

// FindActiveBySlug returns an active product or models.ErrNotFound.
func (r ProductRepo) FindActiveBySlug(ctx context.Context, slug string) (models.Product, error) {
	rec, err := r.products.Query().
		Where(schema.Products.Slug.Eq(slug), schema.Products.CatalogStatus.Eq(schema.ProductsCatalogStatusActive)).
		One(ctx)
	if err != nil {
		return models.Product{}, err
	}
	ps, err := r.hydrate(ctx, []*schema.ProductsRecord{rec})
	if err != nil {
		return models.Product{}, err
	}
	return ps[0], nil
}

// FindByVariationIDs returns the products owning the given Square
// variations, keyed by variation ID. Unknown IDs are simply absent. Products
// are returned whatever their status; callers decide purchasability.
func (r ProductRepo) FindByVariationIDs(ctx context.Context, ids []models.SquareVariationID) (map[models.SquareVariationID]models.Product, error) {
	out := map[models.SquareVariationID]models.Product{}
	if len(ids) == 0 {
		return out, nil
	}
	vars, err := r.variations.Query().
		Where(schema.ProductVariations.SquareVariationID.In(stringsOf(ids)...)).
		All(ctx)
	if err != nil {
		return nil, err
	}
	productIDs := make([]schema.ProductsID, 0, len(vars))
	for _, v := range vars {
		productIDs = append(productIDs, v.Product())
	}
	recs, err := r.products.Query().Where(schema.Products.ID.In(productIDs...)).All(ctx)
	if err != nil {
		return nil, err
	}
	products, err := r.hydrate(ctx, recs)
	if err != nil {
		return nil, err
	}
	for _, p := range products {
		for _, v := range p.Variations {
			if slices.Contains(ids, v.SquareID) {
				out[v.SquareID] = p
			}
		}
	}
	return out, nil
}

// ---------------------------------------------------------------------------
// Catalog sync
// ---------------------------------------------------------------------------

// ListAll returns every cached product regardless of status.
func (r ProductRepo) ListAll(ctx context.Context) ([]models.Product, error) {
	recs, err := r.products.Query().OrderBy(schema.Products.Created.Asc()).All(ctx)
	if err != nil {
		return nil, err
	}
	return r.hydrate(ctx, recs)
}

// Save creates or updates p (by p.ID) together with its variations:
// variations are upserted by Square ID and any no longer present are
// deleted. Modifier lists are referenced by Square ID and must be saved
// separately with ReplaceModifierLists. Sets p.ID on create.
func (r ProductRepo) Save(ctx context.Context, p *models.Product) error {
	var rec *schema.ProductsRecord
	var err error
	if p.ID == "" {
		rec, err = r.products.New()
	} else {
		rec, err = r.products.FindByID(ctx, string(p.ID))
	}
	if err != nil {
		return fmt.Errorf("product %s: %w", p.ID, err)
	}

	cat, err := categoryToDB(p.Category)
	if err != nil {
		return err
	}
	status, err := catalogStatuses.ToDB(p.Status)
	if err != nil {
		return err
	}
	refs := make([]schema.ProductModifierListRef, 0, len(p.ModifierLists))
	for _, ml := range p.ModifierLists {
		ref := schema.ProductModifierListRef{SquareModifierListID: string(ml.List.SquareID)}
		// Only persist limits that differ from the list's own (i.e. overrides).
		if ml.MinSelected != ml.List.MinSelected || ml.MaxSelected != ml.List.MaxSelected {
			ref.MinSelected, ref.MaxSelected = &ml.MinSelected, &ml.MaxSelected
		}
		refs = append(refs, ref)
	}

	rec.SetSquareItemID(string(p.SquareItemID))
	rec.SetSquareVersion(p.SquareVersion)
	rec.SetCatalogStatus(status)
	rec.SetSyncedAt(p.SyncedAt)
	rec.SetName(p.Name)
	rec.SetDescription(p.Description)
	rec.SetCategory(cat)
	rec.SetModifierLists(refs)
	rec.SetSlug(p.Slug)
	rec.SetTagline(p.Tagline)
	rec.SetIngredients(p.Ingredients)
	rec.SetSize(p.Size)
	rec.SetPourTop(p.Pour.Top)
	rec.SetPourBottom(p.Pour.Bottom)
	rec.SetBadge(p.Badge)
	rec.SetSortOrder(p.SortOrder)
	if err := r.products.Save(ctx, rec); err != nil {
		return fmt.Errorf("product %q: %w", p.Slug, err)
	}
	p.ID = models.ProductID(rec.ID())

	return r.saveVariations(ctx, rec.ID(), p.Variations)
}

func (r ProductRepo) saveVariations(ctx context.Context, productID schema.ProductsID, vars []models.ProductVariation) error {
	// Match on this product's rows and on the incoming Square IDs, since a
	// variation can be moved between items in Square.
	incoming := make([]string, len(vars))
	for i, v := range vars {
		incoming[i] = string(v.SquareID)
	}
	existing, err := r.variations.Query().
		Where(dbx.Or(
			schema.ProductVariations.Product.Eq(productID),
			schema.ProductVariations.SquareVariationID.In(incoming...),
		)).
		All(ctx)
	if err != nil {
		return err
	}
	bySquareID := make(map[string]*schema.ProductVariationsRecord, len(existing))
	for _, rec := range existing {
		bySquareID[rec.SquareVariationID()] = rec
	}

	for _, v := range vars {
		rec, ok := bySquareID[string(v.SquareID)]
		if !ok {
			if rec, err = r.variations.New(); err != nil {
				return err
			}
		}
		delete(bySquareID, string(v.SquareID))

		rec.SetProduct(productID)
		rec.SetSquareVariationID(string(v.SquareID))
		rec.SetSquareVersion(v.SquareVersion)
		rec.SetName(v.Name)
		rec.SetPriceAmount(v.Price.Amount)
		rec.SetCurrency(string(v.Price.Currency))
		rec.SetSellable(v.Sellable)
		rec.SetOrdinal(v.Ordinal)
		if err := r.variations.Save(ctx, rec); err != nil {
			return fmt.Errorf("variation %s: %w", v.SquareID, err)
		}
	}

	for _, stale := range bySquareID {
		if stale.Product() != productID {
			continue // belongs to another product that hasn't been synced yet
		}
		if err := r.variations.Delete(ctx, stale); err != nil {
			return err
		}
	}
	return nil
}

// ListModifierLists returns every cached modifier list.
func (r ProductRepo) ListModifierLists(ctx context.Context) ([]models.ModifierList, error) {
	recs, err := r.lists.Query().All(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]models.ModifierList, 0, len(recs))
	for _, rec := range recs {
		ml, err := modifierListFromRecord(rec)
		if err != nil {
			return nil, err
		}
		out = append(out, ml)
	}
	return out, nil
}

// ReplaceModifierLists makes the cached modifier lists exactly lists:
// upserting by Square ID and deleting any others.
func (r ProductRepo) ReplaceModifierLists(ctx context.Context, lists []models.ModifierList) error {
	existing, err := r.lists.Query().All(ctx)
	if err != nil {
		return err
	}
	bySquareID := make(map[string]*schema.ModifierListsRecord, len(existing))
	for _, rec := range existing {
		bySquareID[rec.SquareModifierListID()] = rec
	}

	for _, ml := range lists {
		rec, ok := bySquareID[string(ml.SquareID)]
		if !ok {
			if rec, err = r.lists.New(); err != nil {
				return err
			}
		}
		delete(bySquareID, string(ml.SquareID))

		mods := make([]schema.ModifierJSON, len(ml.Modifiers))
		for i, m := range ml.Modifiers {
			mods[i] = schema.ModifierJSON{
				SquareModifierID: string(m.SquareID),
				Name:             m.Name,
				PriceAmount:      m.Price.Amount,
				Currency:         string(m.Price.Currency),
				Ordinal:          m.Ordinal,
				HiddenOnline:     m.HiddenOnline,
			}
		}
		rec.SetSquareModifierListID(string(ml.SquareID))
		rec.SetSquareVersion(ml.SquareVersion)
		rec.SetName(ml.Name)
		rec.SetMinSelected(ml.MinSelected)
		rec.SetMaxSelected(ml.MaxSelected)
		rec.SetModifiers(mods)
		if err := r.lists.Save(ctx, rec); err != nil {
			return fmt.Errorf("modifier list %s: %w", ml.SquareID, err)
		}
	}

	for _, stale := range bySquareID {
		if err := r.lists.Delete(ctx, stale); err != nil {
			return err
		}
	}
	return nil
}

// ---------------------------------------------------------------------------
// Record -> model
// ---------------------------------------------------------------------------

// hydrate converts product records to models, batch-loading their
// variations and modifier lists (two queries total, not two per product).
func (r ProductRepo) hydrate(ctx context.Context, recs []*schema.ProductsRecord) ([]models.Product, error) {
	if len(recs) == 0 {
		return nil, nil
	}

	ids := make([]schema.ProductsID, len(recs))
	refsByProduct := make(map[schema.ProductsID][]schema.ProductModifierListRef, len(recs))
	var listIDs []string
	for i, rec := range recs {
		ids[i] = rec.ID()
		refs, err := rec.ModifierLists()
		if err != nil {
			return nil, err
		}
		refsByProduct[rec.ID()] = refs
		for _, ref := range refs {
			listIDs = append(listIDs, ref.SquareModifierListID)
		}
	}

	varRecs, err := r.variations.Query().
		Where(schema.ProductVariations.Product.In(ids...)).
		OrderBy(schema.ProductVariations.Ordinal.Asc(), schema.ProductVariations.Name.Asc()).
		All(ctx)
	if err != nil {
		return nil, err
	}
	varsByProduct := map[schema.ProductsID][]models.ProductVariation{}
	for _, v := range varRecs {
		varsByProduct[v.Product()] = append(varsByProduct[v.Product()], models.ProductVariation{
			SquareID:      models.SquareVariationID(v.SquareVariationID()),
			SquareVersion: v.SquareVersion(),
			Name:          v.Name(),
			Price:         models.NewMoney(v.PriceAmount(), models.Currency(v.Currency())),
			Sellable:      v.Sellable(),
			Ordinal:       v.Ordinal(),
		})
	}

	lists := map[string]models.ModifierList{}
	if len(listIDs) > 0 {
		listRecs, err := r.lists.Query().Where(schema.ModifierLists.SquareModifierListID.In(listIDs...)).All(ctx)
		if err != nil {
			return nil, err
		}
		for _, lr := range listRecs {
			ml, err := modifierListFromRecord(lr)
			if err != nil {
				return nil, err
			}
			lists[string(ml.SquareID)] = ml
		}
	}

	out := make([]models.Product, 0, len(recs))
	for _, rec := range recs {
		p, err := productFromRecord(rec)
		if err != nil {
			return nil, err
		}
		p.Variations = varsByProduct[rec.ID()]
		for _, ref := range refsByProduct[rec.ID()] {
			ml, ok := lists[ref.SquareModifierListID]
			if !ok {
				continue // list deleted in Square; the next sync drops the ref
			}
			pml := models.ProductModifierList{List: ml, MinSelected: ml.MinSelected, MaxSelected: ml.MaxSelected}
			if ref.MinSelected != nil && ref.MaxSelected != nil {
				pml.MinSelected, pml.MaxSelected = *ref.MinSelected, *ref.MaxSelected
			}
			p.ModifierLists = append(p.ModifierLists, pml)
		}
		out = append(out, p)
	}
	return out, nil
}

func productFromRecord(rec *schema.ProductsRecord) (models.Product, error) {
	cat, err := categoryFromDB(rec.Category())
	if err != nil {
		return models.Product{}, fmt.Errorf("product %s: %w", rec.ID(), err)
	}
	status, err := catalogStatuses.FromDB(rec.CatalogStatus())
	if err != nil {
		return models.Product{}, fmt.Errorf("product %s: %w", rec.ID(), err)
	}
	ingredients, err := rec.Ingredients()
	if err != nil {
		return models.Product{}, err
	}
	return models.Product{
		ID:            models.ProductID(rec.ID()),
		SquareItemID:  models.SquareItemID(rec.SquareItemID()),
		SquareVersion: rec.SquareVersion(),
		Status:        status,
		SyncedAt:      rec.SyncedAt(),
		Name:          rec.Name(),
		Description:   rec.Description(),
		Category:      cat,
		Slug:          rec.Slug(),
		Tagline:       rec.Tagline(),
		Ingredients:   ingredients,
		Size:          rec.Size(),
		Pour:          models.Pour{Top: rec.PourTop(), Bottom: rec.PourBottom()},
		Badge:         rec.Badge(),
		SortOrder:     rec.SortOrder(),
	}, nil
}

func modifierListFromRecord(rec *schema.ModifierListsRecord) (models.ModifierList, error) {
	mods, err := rec.Modifiers()
	if err != nil {
		return models.ModifierList{}, err
	}
	ml := models.ModifierList{
		SquareID:      models.SquareModifierListID(rec.SquareModifierListID()),
		SquareVersion: rec.SquareVersion(),
		Name:          rec.Name(),
		MinSelected:   rec.MinSelected(),
		MaxSelected:   rec.MaxSelected(),
	}
	for _, m := range mods {
		ml.Modifiers = append(ml.Modifiers, models.Modifier{
			SquareID:     models.SquareModifierID(m.SquareModifierID),
			Name:         m.Name,
			Price:        models.NewMoney(m.PriceAmount, models.Currency(m.Currency)),
			Ordinal:      m.Ordinal,
			HiddenOnline: m.HiddenOnline,
		})
	}
	return ml, nil
}

func stringsOf[T ~string](vs []T) []string {
	out := make([]string, len(vs))
	for i, v := range vs {
		out[i] = string(v)
	}
	return out
}
