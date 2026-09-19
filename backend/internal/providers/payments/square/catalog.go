package square

import (
	"context"
	"slices"
	"strings"

	sq "github.com/square/square-go-sdk/v4"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

// FetchCatalog lists all items, modifier lists and categories. ListCatalog
// never returns deleted objects, so anything missing from the snapshot has
// been deleted in Square.
func (c *Client) FetchCatalog(ctx context.Context) (*payments.CatalogSnapshot, error) {
	// A full sync pages through the whole catalog: allow a few timeouts' worth.
	ctx, cancel := context.WithTimeout(ctx, 4*c.cfg.Timeout)
	defer cancel()

	objects, err := c.listObjects(ctx, sq.CatalogObjectTypeItem, sq.CatalogObjectTypeModifierList, sq.CatalogObjectTypeCategory)
	if err != nil {
		return nil, err
	}
	return c.snapshot(objects), nil
}

func (c *Client) listObjects(ctx context.Context, objectTypes ...sq.CatalogObjectType) ([]*sq.CatalogObject, error) {
	names := make([]string, len(objectTypes))
	for i, t := range objectTypes {
		names[i] = string(t)
	}
	types := strings.Join(names, ",")
	page, err := c.sq.Catalog.List(ctx, &sq.ListCatalogRequest{Types: &types})
	if err != nil {
		return nil, classify("list catalog", err)
	}
	var objects []*sq.CatalogObject
	iter := page.Iterator()
	for iter.Next(ctx) {
		objects = append(objects, iter.Current())
	}
	if err := iter.Err(); err != nil {
		return nil, classify("list catalog", err)
	}
	return objects, nil
}

// snapshot maps raw catalog objects to the provider-neutral snapshot.
func (c *Client) snapshot(objects []*sq.CatalogObject) *payments.CatalogSnapshot {
	categoryNames := map[string]string{}
	for _, o := range objects {
		if cat := o.Category; cat != nil && cat.ID != nil && cat.CategoryData != nil {
			categoryNames[*cat.ID] = deref(cat.CategoryData.Name)
		}
	}

	snap := &payments.CatalogSnapshot{}
	for _, o := range objects {
		switch {
		case o.Item != nil && !deref(o.Item.IsDeleted):
			snap.Items = append(snap.Items, c.item(o.Item, categoryNames))
		case o.ModifierList != nil && !deref(o.ModifierList.IsDeleted):
			snap.ModifierLists = append(snap.ModifierLists, c.modifierList(o.ModifierList))
		}
	}
	return snap
}

func (c *Client) item(o *sq.CatalogObjectItem, categoryNames map[string]string) payments.CatalogItem {
	data := o.ItemData
	if data == nil {
		data = &sq.CatalogItem{}
	}
	item := payments.CatalogItem{
		ID:        models.SquareItemID(o.ID),
		Version:   deref(o.Version),
		Name:      deref(data.Name),
		Available: !deref(data.IsArchived) && c.presentAt(o.PresentAtAllLocations, o.PresentAtLocationIDs, o.AbsentAtLocationIDs),
	}
	item.Description = deref(data.DescriptionPlaintext)
	if item.Description == "" {
		item.Description = deref(data.Description)
	}

	cats := slices.Clone(data.Categories)
	if data.ReportingCategory != nil {
		cats = append(cats, data.ReportingCategory)
	}
	for _, cat := range cats {
		if cat == nil || cat.ID == nil {
			continue
		}
		if name := categoryNames[*cat.ID]; name != "" && !slices.Contains(item.CategoryNames, name) {
			item.CategoryNames = append(item.CategoryNames, name)
		}
	}

	for _, vo := range data.Variations {
		if vo == nil || vo.ItemVariation == nil || deref(vo.ItemVariation.IsDeleted) {
			continue
		}
		v := vo.ItemVariation
		if !c.presentAt(v.PresentAtAllLocations, v.PresentAtLocationIDs, v.AbsentAtLocationIDs) {
			continue
		}
		price, sellable := c.variationPrice(v.ItemVariationData)
		item.Variations = append(item.Variations, models.ProductVariation{
			SquareID:      models.SquareVariationID(v.ID),
			SquareVersion: deref(v.Version),
			Name:          deref(v.ItemVariationData.GetName()),
			Price:         price,
			Sellable:      sellable,
			Ordinal:       int64(deref(v.ItemVariationData.GetOrdinal())),
		})
	}

	for _, info := range data.ModifierListInfo {
		if info == nil || (info.Enabled != nil && !*info.Enabled) {
			continue
		}
		ml := payments.ItemModifierList{ListID: models.SquareModifierListID(info.ModifierListID)}
		// Square: -1 on both means "use the list's own limits".
		if info.MinSelectedModifiers != nil && info.MaxSelectedModifiers != nil &&
			!(*info.MinSelectedModifiers == -1 && *info.MaxSelectedModifiers == -1) {
			minSel, maxSel := normalizeLimit(int64(*info.MinSelectedModifiers)), normalizeLimit(int64(*info.MaxSelectedModifiers))
			ml.MinSelected, ml.MaxSelected = &minSel, &maxSel
		}
		item.ModifierLists = append(item.ModifierLists, ml)
	}
	return item
}

// variationPrice applies our location's override, and reports whether the
// variation can be sold online at a fixed price.
func (c *Client) variationPrice(d *sq.CatalogItemVariation) (models.Money, bool) {
	if d == nil {
		return models.NewMoney(0, c.cfg.Currency), false
	}
	priceMoney, pricing, soldOut := d.PriceMoney, deref(d.PricingType), false
	for _, o := range d.LocationOverrides {
		if o == nil || deref(o.LocationID) != c.cfg.LocationID {
			continue
		}
		if o.PriceMoney != nil {
			priceMoney = o.PriceMoney
		}
		if o.PricingType != nil {
			pricing = *o.PricingType
		}
		soldOut = deref(o.SoldOut)
	}
	sellable := pricing != sq.CatalogPricingTypeVariablePricing &&
		priceMoney != nil && priceMoney.Amount != nil &&
		(d.Sellable == nil || *d.Sellable) && !soldOut
	return money(priceMoney, c.cfg.Currency), sellable
}

func (c *Client) modifierList(o *sq.CatalogObjectModifierList) models.ModifierList {
	data := o.ModifierListData
	if data == nil {
		data = &sq.CatalogModifierList{}
	}
	ml := models.ModifierList{
		SquareID:      models.SquareModifierListID(o.ID),
		SquareVersion: deref(o.Version),
		Name:          deref(data.Name),
		MinSelected:   normalizeLimit(deref(data.MinSelectedModifiers)),
		MaxSelected:   normalizeLimit(deref(data.MaxSelectedModifiers)),
	}
	// Legacy lists express "pick one" via selection_type instead of limits.
	if data.MaxSelectedModifiers == nil && deref(data.SelectionType) == sq.CatalogModifierListSelectionTypeSingle {
		ml.MaxSelected = 1
	}
	for _, mo := range data.Modifiers {
		if mo == nil || mo.Modifier == nil || deref(mo.Modifier.IsDeleted) {
			continue
		}
		m := mo.Modifier
		price, available := c.modifierPrice(m.ModifierData)
		if !available || !c.presentAt(m.PresentAtAllLocations, m.PresentAtLocationIDs, m.AbsentAtLocationIDs) {
			continue
		}
		ml.Modifiers = append(ml.Modifiers, models.Modifier{
			SquareID:     models.SquareModifierID(m.ID),
			Name:         deref(m.ModifierData.GetName()),
			Price:        price,
			Ordinal:      int64(deref(m.ModifierData.GetOrdinal())),
			HiddenOnline: deref(m.ModifierData.GetHiddenOnline()),
		})
	}
	return ml
}

func (c *Client) modifierPrice(d *sq.CatalogModifier) (models.Money, bool) {
	if d == nil {
		return models.NewMoney(0, c.cfg.Currency), false
	}
	priceMoney, soldOut := d.PriceMoney, false
	for _, o := range d.LocationOverrides {
		if o == nil || deref(o.LocationID) != c.cfg.LocationID {
			continue
		}
		if o.PriceMoney != nil {
			priceMoney = o.PriceMoney
		}
		soldOut = deref(o.SoldOut)
	}
	return money(priceMoney, c.cfg.Currency), !soldOut
}

// presentAt implements Square's location availability rules. Square omits
// present_at_all_locations when it is true (the default).
func (c *Client) presentAt(all *bool, present, absent []string) bool {
	if all == nil || *all {
		return !slices.Contains(absent, c.cfg.LocationID)
	}
	return slices.Contains(present, c.cfg.LocationID)
}

// normalizeLimit maps Square's -1 (unset) and other negatives to 0 (none).
func normalizeLimit(v int64) int64 {
	return max(v, 0)
}

// LookupPrices fetches the given variations and modifiers straight from
// Square, including their parent items so archived items are detected.
func (c *Client) LookupPrices(ctx context.Context, variations []models.SquareVariationID, modifiers []models.SquareModifierID) (*payments.PriceCheck, error) {
	check := &payments.PriceCheck{
		Variations: map[models.SquareVariationID]payments.LiveVariation{},
		Modifiers:  map[models.SquareModifierID]payments.LiveModifier{},
	}
	ids := make([]string, 0, len(variations)+len(modifiers))
	for _, v := range variations {
		ids = append(ids, string(v))
	}
	for _, m := range modifiers {
		ids = append(ids, string(m))
	}
	if len(ids) == 0 {
		return check, nil
	}

	ctx, cancel := c.withTimeout(ctx)
	defer cancel()
	resp, err := c.sq.Catalog.BatchGet(ctx, &sq.BatchGetCatalogObjectsRequest{
		ObjectIDs:             ids,
		IncludeRelatedObjects: sq.Bool(true),
	})
	if err != nil {
		return nil, classify("batch get catalog", err)
	}
	if err := errorsIn("batch get catalog", resp.Errors); err != nil {
		return nil, err
	}

	itemAvailable := map[string]bool{}
	for _, o := range resp.RelatedObjects {
		if o != nil && o.Item != nil {
			it := o.Item
			itemAvailable[it.ID] = !deref(it.IsDeleted) && !deref(it.ItemData.GetIsArchived()) &&
				c.presentAt(it.PresentAtAllLocations, it.PresentAtLocationIDs, it.AbsentAtLocationIDs)
		}
	}

	for _, o := range resp.Objects {
		switch {
		case o == nil:
		case o.ItemVariation != nil && !deref(o.ItemVariation.IsDeleted):
			v := o.ItemVariation
			price, sellable := c.variationPrice(v.ItemVariationData)
			itemID := deref(v.ItemVariationData.GetItemID())
			check.Variations[models.SquareVariationID(v.ID)] = payments.LiveVariation{
				ItemID: models.SquareItemID(itemID),
				Price:  price,
				Sellable: sellable && itemAvailable[itemID] &&
					c.presentAt(v.PresentAtAllLocations, v.PresentAtLocationIDs, v.AbsentAtLocationIDs),
			}
		case o.Modifier != nil && !deref(o.Modifier.IsDeleted):
			m := o.Modifier
			price, available := c.modifierPrice(m.ModifierData)
			check.Modifiers[models.SquareModifierID(m.ID)] = payments.LiveModifier{
				Price:     price,
				Available: available && c.presentAt(m.PresentAtAllLocations, m.PresentAtLocationIDs, m.AbsentAtLocationIDs),
			}
		}
	}
	return check, nil
}
