package catalog_test

import (
	"context"
	"errors"
	"testing"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/providers/payments/paymentstest"
	"felisa-cafe/backend/internal/services/catalog"
	"felisa-cafe/backend/internal/testutil"
)

var ctx = context.Background()

func TestSyncAdoptsSeededProductsAndIsIdempotent(t *testing.T) {
	store := database.New(testutil.NewApp(t))
	before, err := store.Products.ListAll(ctx)
	if err != nil {
		t.Fatal(err)
	}

	fake := paymentstest.New()
	fake.Catalog = testutil.Catalog()
	svc := catalog.New(store, fake, testutil.Logger())

	res, err := svc.Sync(ctx)
	if err != nil {
		t.Fatal(err)
	}
	// Both Square items match migration-seeded products (by name), so their
	// local presentation metadata is adopted instead of duplicated.
	if res.Linked != 2 || res.Created != 0 || res.ModifierLists != 2 {
		t.Fatalf("first sync = %+v", res)
	}

	latte, err := svc.Get(ctx, "felisa-latte")
	if err != nil {
		t.Fatal(err)
	}
	if latte.SquareItemID != testutil.LatteItem || latte.Status != models.CatalogActive || latte.Category != models.CategorySignature {
		t.Errorf("latte = %+v", latte)
	}
	if latte.Pour.Top != "#C08A5E" || latte.Tagline == "" {
		t.Error("locally-owned presentation metadata must survive sync")
	}
	if latte.Description != "Ube over espresso." {
		t.Error("Square owns the description")
	}
	if len(latte.Variations) != 2 || len(latte.ModifierLists) != 2 || latte.ModifierLists[0].MinSelected != 1 {
		t.Errorf("latte catalog data = %+v", latte)
	}
	// "Housemade Ube Syrup" was seeded with slug "ube-syrup-bottle".
	if _, err := svc.Get(ctx, "ube-syrup-bottle"); err != nil {
		t.Errorf("adopted-by-name product keeps its slug: %v", err)
	}

	res, err = svc.Sync(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if res.Updated != 2 || res.Linked != 0 || res.Created != 0 {
		t.Errorf("second sync = %+v", res)
	}
	after, _ := store.Products.ListAll(ctx)
	if len(after) != len(before) {
		t.Errorf("sync created duplicates: %d products before, %d after", len(before), len(after))
	}
}

func TestSyncTracksSquareChanges(t *testing.T) {
	store := database.New(testutil.NewApp(t))
	fake := paymentstest.New()
	svc := testutil.SyncCatalog(t, store, fake)

	// In Square: the latte is archived, the syrup deleted, a new item added.
	fake.Catalog.Items[0].Available = false
	fake.Catalog.Items = append(fake.Catalog.Items[:1], payments.CatalogItem{
		ID: "ITEM_NEW", Name: "Calamansi Soda!", Available: true,
		Variations: []models.ProductVariation{{SquareID: "VAR_NEW", Name: "Regular", Price: models.NewMoney(600, models.USD), Sellable: true}},
	})

	res, err := svc.Sync(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if res.Created != 1 || res.Deleted != 1 || len(res.Uncategorized) != 1 {
		t.Errorf("sync = %+v", res)
	}

	if _, err := svc.Get(ctx, "felisa-latte"); !errors.Is(err, models.ErrNotFound) {
		t.Errorf("archived product must leave the menu, got %v", err)
	}
	all, _ := store.Products.ListAll(ctx)
	statuses := map[string]models.CatalogStatus{}
	for _, p := range all {
		statuses[p.Slug] = p.Status
	}
	if statuses["felisa-latte"] != models.CatalogArchived || statuses["ube-syrup-bottle"] != models.CatalogDeleted {
		t.Errorf("statuses = %v", statuses)
	}
	if statuses["calamansi-soda"] != models.CatalogActive {
		t.Errorf("new item should get a slug from its name: %v", statuses)
	}

	// Deleted items come back (with their metadata) if recreated.
	fake.Catalog = testutil.Catalog()
	if _, err := svc.Sync(ctx); err != nil {
		t.Fatal(err)
	}
	if p, err := svc.Get(ctx, "ube-syrup-bottle"); err != nil || p.Pour.Top == "" {
		t.Errorf("restored product = %+v, %v", p, err)
	}
}

func TestSyncRequiresSquare(t *testing.T) {
	svc := catalog.New(database.New(testutil.NewApp(t)), nil, testutil.Logger())
	if _, err := svc.Sync(ctx); !errors.Is(err, payments.ErrNotConfigured) {
		t.Errorf("err = %v", err)
	}
}

func TestFailedFetchLeavesCacheUntouched(t *testing.T) {
	store := database.New(testutil.NewApp(t))
	fake := paymentstest.New()
	svc := testutil.SyncCatalog(t, store, fake)

	fake.FetchErr = payments.ErrUnavailable
	if _, err := svc.Sync(ctx); !errors.Is(err, payments.ErrUnavailable) {
		t.Fatalf("err = %v", err)
	}
	// Browsing keeps working from the cache while Square is down.
	if list, err := svc.List(ctx); err != nil || len(list) != 2 {
		t.Errorf("menu = %d items, %v", len(list), err)
	}
}
