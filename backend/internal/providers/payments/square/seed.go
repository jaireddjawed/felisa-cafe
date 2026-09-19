package square

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/google/uuid"
	sq "github.com/square/square-go-sdk/v4"

	"felisa-cafe/backend/internal/providers/payments"
)

// Sandbox seeding is a developer convenience: it writes a starter menu INTO
// Square so `catalog sync` has something to pull. It is the only code path
// that writes to the Square catalog, and it refuses to run in production,
// where the catalog is managed in the Square Dashboard.

type SeedModifierList struct {
	Name      string
	Min, Max  int64
	Modifiers []SeedModifier
}

type SeedModifier struct {
	Name  string
	Price int64 // minor units
}

type SeedItem struct {
	Name          string
	Description   string
	Category      string
	Variations    []SeedModifier // name + price
	ModifierLists []string       // SeedModifierList names
}

// SeedSandboxCatalog upserts categories, modifier lists and items, matching
// existing Square objects by name so it can be re-run without duplicating.
func (c *Client) SeedSandboxCatalog(ctx context.Context, lists []SeedModifierList, items []SeedItem) error {
	if c.IsProduction() {
		return errors.New("refusing to seed the Square catalog in production")
	}

	existing, err := c.listObjects(ctx, sq.CatalogObjectTypeItem, sq.CatalogObjectTypeModifierList, sq.CatalogObjectTypeCategory)
	if err != nil {
		return err
	}
	// name -> ID for top-level objects, and "parent/child" -> ID for
	// variations and modifiers, so re-seeding updates in place.
	ids := map[string]string{}
	for _, o := range existing {
		switch {
		case o.Category != nil && o.Category.CategoryData != nil:
			ids["category:"+deref(o.Category.CategoryData.Name)] = deref(o.Category.ID)
		case o.ModifierList != nil && o.ModifierList.ModifierListData != nil:
			name := deref(o.ModifierList.ModifierListData.Name)
			ids["list:"+name] = o.ModifierList.ID
			for _, m := range o.ModifierList.ModifierListData.Modifiers {
				if m != nil && m.Modifier != nil {
					ids["modifier:"+name+"/"+deref(m.Modifier.ModifierData.GetName())] = m.Modifier.ID
				}
			}
		case o.Item != nil && o.Item.ItemData != nil:
			name := deref(o.Item.ItemData.Name)
			ids["item:"+name] = o.Item.ID
			for _, v := range o.Item.ItemData.Variations {
				if v != nil && v.ItemVariation != nil {
					ids["variation:"+name+"/"+deref(v.ItemVariation.ItemVariationData.GetName())] = v.ItemVariation.ID
				}
			}
		}
	}
	idFor := func(key string) string {
		if id := ids[key]; id != "" {
			return id
		}
		id := "#" + strings.NewReplacer(" ", "-", "/", "-", ":", "-").Replace(key)
		ids[key] = id
		return id
	}
	usd := func(amount int64) *sq.Money {
		return &sq.Money{Amount: sq.Int64(amount), Currency: sq.Currency(c.cfg.Currency).Ptr()}
	}

	var objects []map[string]any
	categories := map[string]bool{}
	for _, it := range items {
		if it.Category == "" || categories[it.Category] {
			continue
		}
		categories[it.Category] = true
		objects = append(objects, map[string]any{
			"type":          "CATEGORY",
			"id":            idFor("category:" + it.Category),
			"category_data": map[string]any{"name": it.Category},
		})
	}

	for _, l := range lists {
		mods := make([]map[string]any, len(l.Modifiers))
		for i, m := range l.Modifiers {
			mods[i] = map[string]any{
				"type":          "MODIFIER",
				"id":            idFor("modifier:" + l.Name + "/" + m.Name),
				"modifier_data": map[string]any{"name": m.Name, "price_money": usd(m.Price), "ordinal": i},
			}
		}
		objects = append(objects, map[string]any{
			"type": "MODIFIER_LIST",
			"id":   idFor("list:" + l.Name),
			"modifier_list_data": map[string]any{
				"name": l.Name, "modifiers": mods,
				"min_selected_modifiers": l.Min, "max_selected_modifiers": l.Max,
			},
		})
	}

	for _, it := range items {
		vars := make([]map[string]any, len(it.Variations))
		for i, v := range it.Variations {
			vars[i] = map[string]any{
				"type": "ITEM_VARIATION", "id": idFor("variation:" + it.Name + "/" + v.Name),
				"item_variation_data": map[string]any{
					"name": v.Name, "pricing_type": "FIXED_PRICING", "price_money": usd(v.Price), "ordinal": i,
				},
			}
		}
		infos := make([]map[string]any, len(it.ModifierLists))
		for i, name := range it.ModifierLists {
			infos[i] = map[string]any{"modifier_list_id": idFor("list:" + name), "enabled": true}
		}
		data := map[string]any{
			"name": it.Name, "description": it.Description, "variations": vars, "modifier_list_info": infos,
		}
		if it.Category != "" {
			ref := map[string]any{"id": idFor("category:" + it.Category)}
			data["categories"] = []map[string]any{ref}
			data["reporting_category"] = ref
		}
		objects = append(objects, map[string]any{
			"type": "ITEM", "id": idFor("item:" + it.Name), "item_data": data,
		})
	}

	n, err := c.batchUpsertSeed(ctx, objects)
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("square seed catalog: no objects written")
	}
	return nil
}

// batchUpsertSeed avoids the SDK's broken CatalogObject union encoder.
func (c *Client) batchUpsertSeed(ctx context.Context, objects []map[string]any) (int, error) {
	body, err := json.Marshal(map[string]any{"idempotency_key": uuid.NewString(), "batches": []any{map[string]any{"objects": objects}}})
	if err != nil {
		return 0, fmt.Errorf("marshal seed catalog: %w", err)
	}
	baseURL := c.cfg.BaseURL
	if baseURL == "" {
		baseURL = sq.Environments.Sandbox
	}
	ctx, cancel := context.WithTimeout(ctx, 4*c.cfg.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, strings.TrimRight(baseURL, "/")+"/v2/catalog/batch-upsert", bytes.NewReader(body))
	if err != nil {
		return 0, fmt.Errorf("build seed catalog request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.cfg.AccessToken)
	req.Header.Set("Content-Type", "application/json")
	resp, err := (&http.Client{Timeout: c.cfg.Timeout}).Do(req)
	if err != nil {
		return 0, classify("seed catalog", err)
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return 0, classify("read seed catalog response", err)
	}
	var result struct {
		Objects []json.RawMessage `json:"objects"`
		Errors  []*sq.Error       `json:"errors"`
	}
	if err := json.Unmarshal(data, &result); err != nil {
		return 0, fmt.Errorf("decode seed catalog response: %w", err)
	}
	if err := errorsIn("seed catalog", result.Errors); err != nil {
		return 0, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return 0, fmt.Errorf("square seed catalog: %w: HTTP %d", payments.ErrUnavailable, resp.StatusCode)
	}
	return len(result.Objects), nil
}
