package payments

import (
	"context"
	"fmt"
	"math"

	"github.com/google/uuid"
	sq "github.com/square/square-go-sdk/v4"

	"felisa-cafe/backend/internal/models"
)

// noMilkSlugs lists products that skip the shared Milk/Add-Ons modifier
// lists entirely (matcha-cano is matcha over water, not milk).
var noMilkSlugs = map[string]bool{
	"matcha-cano": true,
}

// SyncCatalog implements PaymentProcessor. It creates a new Square Catalog
// item per product missing a CatalogID, and full-replaces the existing item
// (name, price, variations, modifiers) for products that already have one.
func (p *SquareProcessor) SyncCatalog(ctx context.Context, products []*models.Product) ([]CatalogSyncResult, error) {
	// Exactly one milk (required, exclusive) vs. any number of add-ons.
	milkID, err := p.ensureModifierList(ctx, "Milk", []string{
		"Whole Milk", "Oat Milk", "Almond Milk", "Coconut Milk", "Non-Fat Milk",
	}, 1, 1)
	if err != nil {
		return nil, err
	}

	addOnsID, err := p.ensureModifierList(ctx, "Add-Ons", []string{
		"Maple Cold Foam", "Ube Whipped Cream",
	}, 0, 0)
	if err != nil {
		return nil, err
	}

	objects := make([]*sq.CatalogObject, len(products))
	for i, product := range products {
		objects[i] = buildItemObject(product, milkID, addOnsID)
	}

	resp, err := p.client.Catalog.BatchUpsert(ctx, &sq.BatchUpsertCatalogObjectsRequest{
		IdempotencyKey: uuid.NewString(),
		Batches:        []*sq.CatalogObjectBatch{{Objects: objects}},
	})
	if err != nil {
		return nil, fmt.Errorf("batch upsert catalog items: %w", err)
	}

	mapped := map[string]string{}
	for _, m := range resp.IDMappings {
		if m.ClientObjectID != nil && m.ObjectID != nil {
			mapped[*m.ClientObjectID] = *m.ObjectID
		}
	}

	results := make([]CatalogSyncResult, len(products))
	for i, product := range products {
		id := product.CatalogID
		if id == "" {
			id = mapped[itemTempID(product)]
		}
		results[i] = CatalogSyncResult{Slug: product.Slug, CatalogID: id}
	}

	return results, nil
}

func itemTempID(p *models.Product) string {
	return "#" + p.Slug
}

func buildItemObject(p *models.Product, milkID, addOnsID string) *sq.CatalogObject {
	id := itemTempID(p)
	if p.CatalogID != "" {
		id = p.CatalogID
	}

	var modifierInfo []*sq.CatalogItemModifierListInfo
	if !noMilkSlugs[p.Slug] {
		modifierInfo = []*sq.CatalogItemModifierListInfo{
			{ModifierListID: milkID},
			{ModifierListID: addOnsID},
		}
	}

	// Bases (e.g. Espresso vs Matcha) are priced identically per the menu,
	// so they become same-priced variations rather than a modifier.
	bases := p.Bases
	if len(bases) == 0 {
		bases = []string{"Regular"}
	}

	priceMoney := &sq.Money{
		Amount:   sq.Int64(int64(math.Round(p.Price * 100))),
		Currency: sq.CurrencyUsd.Ptr(),
	}

	variations := make([]*sq.CatalogObject, len(bases))
	for i, base := range bases {
		variations[i] = &sq.CatalogObject{
			Type: string(sq.CatalogObjectTypeItemVariation),
			ItemVariation: &sq.CatalogObjectItemVariation{
				ID: fmt.Sprintf("#%s-variation-%d", p.Slug, i),
				ItemVariationData: &sq.CatalogItemVariation{
					Name:        sq.String(base),
					PricingType: sq.CatalogPricingTypeFixedPricing.Ptr(),
					PriceMoney:  priceMoney,
				},
			},
		}
	}

	return &sq.CatalogObject{
		Type: string(sq.CatalogObjectTypeItem),
		Item: &sq.CatalogObjectItem{
			ID: id,
			ItemData: &sq.CatalogItem{
				Name:             sq.String(p.Name),
				Description:      sq.String(p.Tagline),
				Variations:       variations,
				ModifierListInfo: modifierInfo,
			},
		},
	}
}

// ensureModifierList finds a MODIFIER_LIST catalog object by exact name and
// full-replaces it (creating it if it doesn't exist yet) with $0 modifiers,
// since milk/add-ons are free per the menu, and the given selection limits
// (e.g. min=max=1 makes a list required-and-exclusive, like a radio button;
// min=max=0 leaves it optional with no cap). Modifier lists are shared
// across products, so they're looked up by name rather than cached on any
// single PocketBase record, and re-upserted on every sync so limit changes
// here also correct whatever Square already has.
func (p *SquareProcessor) ensureModifierList(ctx context.Context, name string, modifierNames []string, minSelected, maxSelected int64) (string, error) {
	found, err := p.client.Catalog.Search(ctx, &sq.SearchCatalogObjectsRequest{
		ObjectTypes: []sq.CatalogObjectType{sq.CatalogObjectTypeModifierList},
		Query: &sq.CatalogQuery{
			ExactQuery: &sq.CatalogQueryExact{AttributeName: "name", AttributeValue: name},
		},
	})
	if err != nil {
		return "", fmt.Errorf("search modifier list %q: %w", name, err)
	}

	existingID := ""
	for _, obj := range found.Objects {
		if obj.ModifierList == nil || obj.ModifierList.ModifierListData == nil {
			continue
		}
		data := obj.ModifierList.ModifierListData
		if data.Name != nil && *data.Name == name {
			existingID = obj.ModifierList.ID
			break
		}
	}

	listID := "#modifier-list"
	if existingID != "" {
		listID = existingID
	}

	modifiers := make([]*sq.CatalogObject, len(modifierNames))
	for i, modName := range modifierNames {
		modifiers[i] = &sq.CatalogObject{
			Type: string(sq.CatalogObjectTypeModifier),
			Modifier: &sq.CatalogObjectModifier{
				ID: fmt.Sprintf("#modifier-%d", i),
				ModifierData: &sq.CatalogModifier{
					Name:       sq.String(modName),
					PriceMoney: &sq.Money{Amount: sq.Int64(0), Currency: sq.CurrencyUsd.Ptr()},
				},
			},
		}
	}

	resp, err := p.client.Catalog.BatchUpsert(ctx, &sq.BatchUpsertCatalogObjectsRequest{
		IdempotencyKey: uuid.NewString(),
		Batches: []*sq.CatalogObjectBatch{{
			Objects: []*sq.CatalogObject{{
				Type: string(sq.CatalogObjectTypeModifierList),
				ModifierList: &sq.CatalogObjectModifierList{
					ID: listID,
					ModifierListData: &sq.CatalogModifierList{
						Name:                 sq.String(name),
						Modifiers:            modifiers,
						MinSelectedModifiers: sq.Int64(minSelected),
						MaxSelectedModifiers: sq.Int64(maxSelected),
					},
				},
			}},
		}},
	})
	if err != nil {
		return "", fmt.Errorf("upsert modifier list %q: %w", name, err)
	}

	if existingID != "" {
		return existingID, nil
	}
	for _, m := range resp.IDMappings {
		if m.ClientObjectID != nil && *m.ClientObjectID == listID && m.ObjectID != nil {
			return *m.ObjectID, nil
		}
	}

	return "", fmt.Errorf("create modifier list %q: no id mapping returned", name)
}
