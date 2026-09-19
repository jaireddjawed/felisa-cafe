package database_test

import (
	"context"
	"errors"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/testutil"
)

var ctx = context.Background()

func usd(a int64) models.Money { return models.NewMoney(a, models.USD) }

func TestVerifyAcceptsMigratedSchema(t *testing.T) {
	store := database.New(testutil.NewApp(t))
	if err := store.Verify(); err != nil {
		t.Fatalf("freshly migrated schema should match generated code: %v", err)
	}
}

// Schema drift (e.g. an admin edits a collection in the dashboard) must be
// caught at startup, not surface later as silently empty values.
func TestVerifyDetectsSchemaDrift(t *testing.T) {
	cases := map[string]struct {
		mutate func(*core.Collection)
		want   string
	}{
		"removed field": {
			mutate: func(c *core.Collection) { c.Fields.RemoveByName("tagline") },
			want:   "products.tagline: field missing",
		},
		"changed type": {
			mutate: func(c *core.Collection) {
				c.Fields.RemoveByName("sort_order")
				c.Fields.Add(&core.TextField{Name: "sort_order"})
			},
			want: `products.sort_order: type "text", expected "number"`,
		},
		"new select option": {
			mutate: func(c *core.Collection) {
				f := c.Fields.GetByName("category").(*core.SelectField)
				f.Values = append(f.Values, "pastries")
			},
			want: "products.category: select values",
		},
	}
	for name, tc := range cases {
		t.Run(name, func(t *testing.T) {
			app := testutil.NewApp(t)
			c, err := app.FindCollectionByNameOrId("products")
			if err != nil {
				t.Fatal(err)
			}
			tc.mutate(c)
			if err := app.Save(c); err != nil {
				t.Fatal(err)
			}
			err = database.New(app).Verify()
			if err == nil || !strings.Contains(err.Error(), tc.want) {
				t.Fatalf("Verify() = %v, want error containing %q", err, tc.want)
			}
		})
	}
}

func sampleProduct() models.Product {
	milk := models.ModifierList{
		SquareID: "ML1", Name: "Milk", MinSelected: 1, MaxSelected: 1, SquareVersion: 3,
		Modifiers: []models.Modifier{{SquareID: "M1", Name: "Oat", Price: usd(0)}, {SquareID: "M2", Name: "Whole", Price: usd(50), Ordinal: 1, HiddenOnline: true}},
	}
	return models.Product{
		SquareItemID: "SQ_ITEM", SquareVersion: 7, Status: models.CatalogActive,
		SyncedAt: time.Date(2026, 9, 1, 12, 30, 0, 0, time.UTC),
		Name:     "Test Latte", Description: "desc", Category: models.CategoryMatcha,
		Slug: "test-latte", Tagline: "tag", Ingredients: []string{"a", "b"}, Size: "12oz",
		Pour: models.Pour{Top: "#111", Bottom: "#222"}, Badge: "New", SortOrder: 2,
		Variations: []models.ProductVariation{
			{SquareID: "V1", Name: "Small", Price: usd(650), Sellable: true, Ordinal: 0, SquareVersion: 7},
			{SquareID: "V2", Name: "Large", Price: usd(750), Sellable: false, Ordinal: 1, SquareVersion: 7},
		},
		// Item-level override of the list's limits.
		ModifierLists: []models.ProductModifierList{{List: milk, MinSelected: 0, MaxSelected: 1}},
	}
}

func TestProductAggregateRoundTrip(t *testing.T) {
	store := database.New(testutil.NewApp(t))
	p := sampleProduct()
	if err := store.Products.ReplaceModifierLists(ctx, []models.ModifierList{p.ModifierLists[0].List}); err != nil {
		t.Fatal(err)
	}
	if err := store.Products.Save(ctx, &p); err != nil {
		t.Fatal(err)
	}
	if p.ID == "" {
		t.Fatal("Save should assign an ID")
	}

	got, err := store.Products.FindActiveBySlug(ctx, "test-latte")
	if err != nil {
		t.Fatal(err)
	}
	if !got.SyncedAt.Equal(p.SyncedAt) {
		t.Errorf("SyncedAt = %v, want %v", got.SyncedAt, p.SyncedAt)
	}
	got.SyncedAt = p.SyncedAt
	if !reflect.DeepEqual(got, p) {
		t.Errorf("round trip mismatch:\n got %+v\nwant %+v", got, p)
	}
}

func TestProductSaveReplacesVariations(t *testing.T) {
	store := database.New(testutil.NewApp(t))
	p := sampleProduct()
	p.ModifierLists = nil
	if err := store.Products.Save(ctx, &p); err != nil {
		t.Fatal(err)
	}

	p.Variations = []models.ProductVariation{
		{SquareID: "V2", Name: "Large", Price: usd(800), Sellable: true},
		{SquareID: "V3", Name: "Huge", Price: usd(900), Sellable: true, Ordinal: 2},
	}
	if err := store.Products.Save(ctx, &p); err != nil {
		t.Fatal(err)
	}

	byVar, err := store.Products.FindByVariationIDs(ctx, []models.SquareVariationID{"V1", "V2", "V3"})
	if err != nil {
		t.Fatal(err)
	}
	if _, ok := byVar["V1"]; ok {
		t.Error("V1 was removed and should no longer resolve")
	}
	got := byVar["V2"]
	if len(got.Variations) != 2 || got.Variations[0].Price != usd(800) {
		t.Errorf("variations = %+v", got.Variations)
	}
}

func TestListByCategoriesFiltersStatusAndCategory(t *testing.T) {
	store := database.New(testutil.NewApp(t))
	mk := func(slug string, cat models.ProductCategory, status models.CatalogStatus, sort int64) {
		p := models.Product{Slug: slug, Name: slug, Category: cat, Status: status, SortOrder: sort}
		if err := store.Products.Save(ctx, &p); err != nil {
			t.Fatal(err)
		}
	}
	mk("b-sig", models.CategorySignature, models.CatalogActive, 2)
	mk("a-sig", models.CategorySignature, models.CatalogActive, 1)
	mk("matcha", models.CategoryMatcha, models.CatalogActive, 0)
	mk("merch", models.CategoryMerch, models.CatalogActive, 0)
	mk("gone", models.CategorySignature, models.CatalogDeleted, 0)
	mk("archived", models.CategoryMatcha, models.CatalogArchived, 0)

	got, err := store.Products.ListByCategories(ctx, models.CategorySignature, models.CategoryMatcha)
	if err != nil {
		t.Fatal(err)
	}
	var slugs []string
	for _, p := range got {
		slugs = append(slugs, p.Slug)
	}
	if want := []string{"matcha", "a-sig", "b-sig"}; !slices.Equal(slugs, want) {
		t.Errorf("slugs = %v, want %v", slugs, want)
	}

	if _, err := store.Products.FindActiveBySlug(ctx, "gone"); !errors.Is(err, models.ErrNotFound) {
		t.Errorf("deleted product should be ErrNotFound, got %v", err)
	}
}

func TestOrderRoundTripAndQueries(t *testing.T) {
	app := testutil.NewApp(t)
	store := database.New(app)
	alice, _ := testutil.NewUser(t, app, "alice@example.com", "Alice")
	bob, _ := testutil.NewUser(t, app, "bob@example.com", "Bob")

	paidAt := time.Date(2026, 9, 1, 9, 0, 0, 0, time.UTC)
	o := models.Order{
		UserID: alice, Status: models.OrderPaid,
		Customer: models.Contact{Name: "Alice", Email: "alice@example.com", Phone: "+1 555 0100"},
		Notes:    "extra hot",
		Items: []models.OrderItem{{
			ProductID: "p1", ProductSlug: "latte", ProductName: "Latte", Category: models.CategorySignature,
			VariationID: "V1", VariationName: "Espresso", Quantity: 2, UnitPrice: usd(950), Total: usd(1900),
			Modifiers: []models.OrderItemModifier{{ModifierID: "M1", Name: "Ube Cream", Price: usd(100)}},
			Note:      "less ice",
		}},
		Subtotal: usd(1900), Tax: usd(190), Total: usd(2090),
		IdempotencyKey:   "key-0123456789abcdef",
		Square:           models.SquareOrderRefs{OrderID: "SQO1", OrderVersion: 4, PaymentLinkID: "PL1", PaymentID: "PAY1", CheckoutURL: "https://sq/x"},
		EstimatedReadyAt: paidAt.Add(10 * time.Minute), PaidAt: paidAt,
	}
	if err := store.Orders.Save(ctx, &o); err != nil {
		t.Fatal(err)
	}
	if o.Created.IsZero() {
		t.Error("Created should be populated after save")
	}

	got, err := store.Orders.FindBySquareOrderID(ctx, "SQO1")
	if err != nil {
		t.Fatal(err)
	}
	if got.Total != usd(2090) || got.Tax != usd(190) || got.Items[0].Modifiers[0].Price != usd(100) ||
		got.Items[0].Category != models.CategorySignature || !got.PaidAt.Equal(paidAt) || got.Square != o.Square {
		t.Errorf("round trip mismatch: %+v", got)
	}
	if byKey, err := store.Orders.FindByIdempotencyKey(ctx, o.IdempotencyKey); err != nil || byKey.ID != o.ID {
		t.Errorf("FindByIdempotencyKey = %v, %v", byKey.ID, err)
	}

	// Idempotency keys are unique at the database level.
	dup := o
	dup.ID, dup.Square = "", models.SquareOrderRefs{}
	if err := store.Orders.Save(ctx, &dup); err == nil {
		t.Error("expected unique violation on duplicate idempotency key")
	}

	if list, _ := store.Orders.ListByUser(ctx, bob, 10); len(list) != 0 {
		t.Errorf("bob sees %d of alice's orders", len(list))
	}
	if list, _ := store.Orders.ListByUser(ctx, alice, 10); len(list) != 1 {
		t.Errorf("alice has %d orders, want 1", len(list))
	}
	if queue, _ := store.Orders.ListInQueue(ctx); len(queue) != 1 {
		t.Errorf("queue has %d orders, want 1", len(queue))
	}
}

func TestCartTokensAreStoredHashed(t *testing.T) {
	app := testutil.NewApp(t)
	store := database.New(app)
	owner := models.CartOwner{Token: "guest-secret-token"}
	c := models.Cart{Items: []models.CartItem{{LineID: "l1", VariationID: "V1", ModifierIDs: []models.SquareModifierID{"M1"}, Quantity: 2}}}
	if err := store.Carts.Save(ctx, owner, &c); err != nil {
		t.Fatal(err)
	}

	got, err := store.Carts.FindByOwner(ctx, owner)
	if err != nil || len(got.Items) != 1 || got.Items[0].ModifierIDs[0] != "M1" {
		t.Fatalf("FindByOwner = %+v, %v", got, err)
	}
	if _, err := store.Carts.FindByOwner(ctx, models.CartOwner{Token: "other"}); !errors.Is(err, models.ErrNotFound) {
		t.Errorf("wrong token should not find the cart, got %v", err)
	}

	var raw int
	if err := app.DB().NewQuery("SELECT count(*) FROM carts WHERE token_hash LIKE '%guest-secret-token%'").Row(&raw); err != nil {
		t.Fatal(err)
	}
	if raw != 0 {
		t.Error("raw cart token was persisted")
	}
}

func TestWebhookEventsAreIdempotent(t *testing.T) {
	store := database.New(testutil.NewApp(t))
	for range 2 {
		if err := store.WebhookEvents.MarkProcessed(ctx, "evt-1", "payment.updated"); err != nil {
			t.Fatal(err)
		}
	}
	if seen, _ := store.WebhookEvents.Seen(ctx, "evt-1"); !seen {
		t.Error("evt-1 should be seen")
	}
}

func TestUserIDFromAuthOnlyAcceptsCustomers(t *testing.T) {
	app := testutil.NewApp(t)
	id, rec := testutil.NewUser(t, app, "c@example.com", "C")
	if got, ok := database.UserIDFromAuth(rec); !ok || got != id {
		t.Errorf("customer auth = %q, %v", got, ok)
	}
	superusers, _ := app.FindCollectionByNameOrId(core.CollectionNameSuperusers)
	if _, ok := database.UserIDFromAuth(core.NewRecord(superusers)); ok {
		t.Error("superuser auth must not be treated as a customer")
	}
	if _, ok := database.UserIDFromAuth(nil); ok {
		t.Error("nil auth must not be a customer")
	}
}
