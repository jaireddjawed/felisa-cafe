package migrations

import (
	"encoding/json"
	"fmt"
	"math"

	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/migrations"
)

// Reshapes the schema around Square as the commerce source of truth:
//
//   - products becomes a cache of Square catalog items plus locally-owned
//     presentation metadata (slug, tagline, pour colors, ...). Prices move to
//     product_variations, one row per Square item variation, in integer
//     minor units.
//   - modifier_lists caches Square modifier lists (milk, add-ons, ...).
//   - carts holds server-side carts for guests (by token hash) and users.
//   - orders becomes a local projection of Square orders with a line item
//     snapshot, money in minor units, and the identifiers reconciliation
//     needs.
//   - webhook_events records processed Square webhook event IDs.
//
// Application code never uses these names directly: run `go generate ./...`
// after changing this (or any) migration to regenerate the typed persistence
// layer in internal/database/internal/schema.
func init() {
	migrations.Register(func(app core.App) error {
		if err := upProducts(app); err != nil {
			return fmt.Errorf("products: %w", err)
		}
		if err := upProductVariations(app); err != nil {
			return fmt.Errorf("product_variations: %w", err)
		}
		if err := upModifierLists(app); err != nil {
			return fmt.Errorf("modifier_lists: %w", err)
		}
		if err := upUsers(app); err != nil {
			return fmt.Errorf("users: %w", err)
		}
		if err := upCarts(app); err != nil {
			return fmt.Errorf("carts: %w", err)
		}
		if err := upOrders(app); err != nil {
			return fmt.Errorf("orders: %w", err)
		}
		if err := upWebhookEvents(app); err != nil {
			return fmt.Errorf("webhook_events: %w", err)
		}
		return nil
	}, func(app core.App) error {
		for _, name := range []string{"webhook_events", "carts", "product_variations", "modifier_lists"} {
			collection, err := app.FindCollectionByNameOrId(name)
			if err != nil {
				continue
			}
			if err := app.Delete(collection); err != nil {
				return err
			}
		}
		// The products/orders/users alterations are not reversed: the legacy
		// float price and order shapes cannot be reconstructed from Square data.
		return nil
	})
}

func upProducts(app core.App) error {
	products, err := app.FindCollectionByNameOrId("products")
	if err != nil {
		return err
	}

	// Prices and bases are Square's (item variations), not ours.
	products.Fields.RemoveByName("price")
	products.Fields.RemoveByName("bases")
	products.Fields.RemoveByName("catalog_id")
	products.RemoveIndex("idx_products_catalog_id")

	// Items created in Square have no local metadata until an admin adds it.
	if f, ok := products.Fields.GetByName("category").(*core.SelectField); ok {
		f.Required = false
	}
	for _, name := range []string{"pour_top", "pour_bottom"} {
		if f, ok := products.Fields.GetByName(name).(*core.TextField); ok {
			f.Required = false
		}
	}

	products.Fields.Add(
		&core.TextField{Name: "square_item_id", Max: 100},
		&core.SelectField{
			Name:      "catalog_status",
			Required:  true,
			MaxSelect: 1,
			Values:    []string{"unlinked", "active", "archived", "deleted"},
		},
		&core.NumberField{Name: "square_version", OnlyInt: true},
		// []ProductModifierListRef — which Square modifier lists apply to
		// this item, with any item-level selection overrides.
		&core.JSONField{Name: "modifier_lists", MaxSize: 1 << 16},
		&core.NumberField{Name: "sort_order", OnlyInt: true},
		&core.DateField{Name: "synced_at"},
	)
	products.AddIndex("idx_products_square_item_id", true, "square_item_id", "square_item_id != ''")
	products.AddIndex("idx_products_catalog_status", false, "catalog_status", "")

	// Browsing goes through /api/menu, but keep direct REST reads limited to
	// what the storefront actually sells.
	activeRule := "catalog_status = 'active'"
	products.ListRule = &activeRule
	products.ViewRule = &activeRule

	if err := app.Save(products); err != nil {
		return err
	}

	// Pre-existing (seeded) rows carry presentation metadata only. The first
	// catalog sync adopts each one by slug and marks it active.
	_, err = app.DB().NewQuery("UPDATE products SET catalog_status = 'unlinked' WHERE catalog_status = ''").Execute()
	return err
}

func upProductVariations(app core.App) error {
	products, err := app.FindCollectionByNameOrId("products")
	if err != nil {
		return err
	}

	c := core.NewBaseCollection("product_variations")
	c.Fields.Add(
		&core.RelationField{Name: "product", Required: true, MaxSelect: 1, CollectionId: products.Id, CascadeDelete: true},
		&core.TextField{Name: "square_variation_id", Required: true, Max: 100},
		&core.TextField{Name: "name", Max: 255},
		&core.NumberField{Name: "price_amount", OnlyInt: true, Min: floatPtr(0)},
		&core.TextField{Name: "currency", Required: true, Min: 3, Max: 3},
		// False for variable-priced or unsellable variations: those can
		// never be ordered online, since we can't price them.
		&core.BoolField{Name: "sellable"},
		&core.NumberField{Name: "ordinal", OnlyInt: true},
		&core.NumberField{Name: "square_version", OnlyInt: true},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	c.AddIndex("idx_product_variations_square_id", true, "square_variation_id", "")
	c.AddIndex("idx_product_variations_product", false, "product", "")

	return app.Save(c)
}

func upModifierLists(app core.App) error {
	c := core.NewBaseCollection("modifier_lists")
	c.Fields.Add(
		&core.TextField{Name: "square_modifier_list_id", Required: true, Max: 100},
		&core.TextField{Name: "name", Max: 255},
		// Normalized Square semantics: 0 = no minimum / no maximum.
		&core.NumberField{Name: "min_selected", OnlyInt: true, Min: floatPtr(0)},
		&core.NumberField{Name: "max_selected", OnlyInt: true, Min: floatPtr(0)},
		// []ModifierSnapshot
		&core.JSONField{Name: "modifiers", MaxSize: 1 << 16},
		&core.NumberField{Name: "square_version", OnlyInt: true},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	c.AddIndex("idx_modifier_lists_square_id", true, "square_modifier_list_id", "")

	return app.Save(c)
}

func upUsers(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}
	// Saved contact info so signed-in customers don't retype it at checkout.
	users.Fields.Add(&core.TextField{Name: "phone", Max: 40})
	return app.Save(users)
}

func upCarts(app core.App) error {
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}

	c := core.NewBaseCollection("carts")
	c.Fields.Add(
		// Exactly one of user / token_hash is set.
		&core.RelationField{Name: "user", MaxSelect: 1, CollectionId: users.Id, CascadeDelete: true},
		// SHA-256 of the guest cart token; the raw token only lives client-side.
		&core.TextField{Name: "token_hash", Max: 64},
		// []CartItemJSON
		&core.JSONField{Name: "items", MaxSize: 1 << 16},
		&core.AutodateField{Name: "created", OnCreate: true},
		&core.AutodateField{Name: "updated", OnCreate: true, OnUpdate: true},
	)
	c.AddIndex("idx_carts_user", true, "user", "user != ''")
	c.AddIndex("idx_carts_token_hash", true, "token_hash", "token_hash != ''")

	return app.Save(c)
}

// legacy order item shape written by the original /api/checkout.
type legacyOrderItem struct {
	Slug      string   `json:"slug"`
	Name      string   `json:"name"`
	UnitPrice float64  `json:"unitPrice"`
	Qty       int      `json:"qty"`
	Options   []string `json:"options"`
}

func upOrders(app core.App) error {
	orders, err := app.FindCollectionByNameOrId("orders")
	if err != nil {
		return err
	}
	users, err := app.FindCollectionByNameOrId("users")
	if err != nil {
		return err
	}

	newStatuses := []string{"pending_payment", "paid", "preparing", "ready", "completed", "cancelled"}

	// Step 1: add the new fields, allowing both old and new status values.
	status, ok := orders.Fields.GetByName("status").(*core.SelectField)
	if !ok {
		return fmt.Errorf("orders.status is not a select field")
	}
	status.Values = append(newStatuses, "pending", "confirmed")

	orders.Fields.Add(
		&core.RelationField{Name: "user", MaxSelect: 1, CollectionId: users.Id},
		// []OrderLineItemJSON — immutable snapshot taken at checkout.
		&core.JSONField{Name: "line_items", MaxSize: 1 << 18},
		&core.TextField{Name: "currency", Max: 3},
		&core.NumberField{Name: "subtotal_amount", OnlyInt: true, Min: floatPtr(0)},
		&core.NumberField{Name: "tax_amount", OnlyInt: true, Min: floatPtr(0)},
		&core.NumberField{Name: "total_amount", OnlyInt: true, Min: floatPtr(0)},
		&core.TextField{Name: "idempotency_key", Max: 255},
		&core.TextField{Name: "access_token_hash", Max: 64},
		&core.TextField{Name: "square_order_id", Max: 100},
		&core.NumberField{Name: "square_order_version", OnlyInt: true},
		&core.TextField{Name: "square_payment_link_id", Max: 100},
		&core.TextField{Name: "square_payment_id", Max: 100},
		&core.TextField{Name: "checkout_url", Max: 2048},
		&core.DateField{Name: "estimated_ready_at"},
		&core.DateField{Name: "paid_at"},
		&core.DateField{Name: "completed_at"},
		&core.DateField{Name: "last_synced_at"},
	)
	if err := app.Save(orders); err != nil {
		return err
	}

	// Step 2: convert legacy rows (float prices, old statuses).
	records, err := app.FindAllRecords(orders)
	if err != nil {
		return err
	}
	for _, r := range records {
		switch r.GetString("status") {
		case "pending":
			r.Set("status", "pending_payment")
		case "confirmed":
			r.Set("status", "paid")
		}

		var items []legacyOrderItem
		if err := r.UnmarshalJSONField("items", &items); err != nil {
			return fmt.Errorf("order %s items: %w", r.Id, err)
		}
		lineItems := make([]map[string]any, 0, len(items))
		var subtotal int64
		for _, it := range items {
			unit := int64(math.Round(it.UnitPrice * 100))
			modifiers := make([]map[string]any, 0, len(it.Options))
			for _, o := range it.Options {
				modifiers = append(modifiers, map[string]any{"name": o, "price_amount": 0})
			}
			lineItems = append(lineItems, map[string]any{
				"product_slug":      it.Slug,
				"product_name":      it.Name,
				"quantity":          it.Qty,
				"unit_price_amount": unit,
				"total_amount":      unit * int64(it.Qty),
				"modifiers":         modifiers,
			})
			subtotal += unit * int64(it.Qty)
		}
		raw, err := json.Marshal(lineItems)
		if err != nil {
			return err
		}
		r.Set("line_items", raw)
		r.Set("currency", "USD")
		r.Set("subtotal_amount", subtotal)
		r.Set("total_amount", subtotal)

		if err := app.SaveNoValidate(r); err != nil {
			return fmt.Errorf("order %s: %w", r.Id, err)
		}
	}

	// Step 3: drop the legacy fields and statuses.
	orders, err = app.FindCollectionByNameOrId("orders")
	if err != nil {
		return err
	}
	if status, ok := orders.Fields.GetByName("status").(*core.SelectField); ok {
		status.Values = newStatuses
	}
	orders.Fields.RemoveByName("items")
	orders.Fields.RemoveByName("subtotal")

	orders.AddIndex("idx_orders_idempotency_key", true, "idempotency_key", "idempotency_key != ''")
	orders.AddIndex("idx_orders_square_order_id", true, "square_order_id", "square_order_id != ''")
	orders.AddIndex("idx_orders_user", false, "user", "")
	orders.AddIndex("idx_orders_status", false, "status", "")

	return app.Save(orders)
}

func upWebhookEvents(app core.App) error {
	c := core.NewBaseCollection("webhook_events")
	c.Fields.Add(
		&core.TextField{Name: "event_id", Required: true, Max: 255},
		&core.TextField{Name: "event_type", Max: 255},
		&core.AutodateField{Name: "created", OnCreate: true},
	)
	c.AddIndex("idx_webhook_events_event_id", true, "event_id", "")
	return app.Save(c)
}
