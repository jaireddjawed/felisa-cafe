// Package testutil provides fixtures shared by tests: a fully migrated
// throwaway PocketBase app and a small Square catalog.
package testutil

import (
	"context"
	"io"
	"log/slog"
	"testing"

	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/database"
	_ "felisa-cafe/backend/internal/migrations"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/providers/payments/paymentstest"
	"felisa-cafe/backend/internal/services/catalog"
)

// NewApp returns a bootstrapped PocketBase app with every migration applied,
// in a temp dir removed after the test.
func NewApp(t testing.TB) core.App {
	t.Helper()
	app := core.NewBaseApp(core.BaseAppConfig{DataDir: t.TempDir()})
	if err := app.Bootstrap(); err != nil {
		t.Fatal(err)
	}
	if err := app.RunAllMigrations(); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = app.ClearBootstrap() })
	return app
}

func Logger() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// Square IDs used by Catalog().
const (
	LatteItem        models.SquareItemID         = "ITEM_LATTE"
	LatteEspresso    models.SquareVariationID    = "VAR_LATTE_ESPRESSO"
	LatteMatcha      models.SquareVariationID    = "VAR_LATTE_MATCHA"
	SyrupItem        models.SquareItemID         = "ITEM_SYRUP"
	SyrupRegular     models.SquareVariationID    = "VAR_SYRUP"
	MilkList         models.SquareModifierListID = "ML_MILK"
	OatMilk          models.SquareModifierID     = "MOD_OAT"
	WholeMilk        models.SquareModifierID     = "MOD_WHOLE"
	AddOnsList       models.SquareModifierListID = "ML_ADDONS"
	UbeCream         models.SquareModifierID     = "MOD_UBE_CREAM"
	MapleFoam        models.SquareModifierID     = "MOD_MAPLE"
	HiddenSecretMenu models.SquareModifierID     = "MOD_HIDDEN"
)

func usd(amount int64) models.Money { return models.NewMoney(amount, models.USD) }

// Catalog is a small Square catalog: a drink with a required single milk
// choice and optional add-ons, and a pantry item. "Felisa Latte" and
// "Housemade Ube Syrup" match locally-seeded products, so a sync adopts them.
func Catalog() payments.CatalogSnapshot {
	return payments.CatalogSnapshot{
		ModifierLists: []models.ModifierList{
			{SquareID: MilkList, Name: "Milk", MinSelected: 1, MaxSelected: 1, SquareVersion: 1, Modifiers: []models.Modifier{
				{SquareID: WholeMilk, Name: "Whole Milk", Price: usd(0)},
				{SquareID: OatMilk, Name: "Oat Milk", Price: usd(0), Ordinal: 1},
			}},
			{SquareID: AddOnsList, Name: "Add-Ons", SquareVersion: 1, Modifiers: []models.Modifier{
				{SquareID: UbeCream, Name: "Ube Whipped Cream", Price: usd(100)},
				{SquareID: MapleFoam, Name: "Maple Cold Foam", Price: usd(100), Ordinal: 1},
				{SquareID: HiddenSecretMenu, Name: "Staff Special", Price: usd(0), HiddenOnline: true},
			}},
		},
		Items: []payments.CatalogItem{
			{
				ID: LatteItem, Version: 1, Name: "Felisa Latte", Description: "Ube over espresso.",
				CategoryNames: []string{"Signature Drinks"}, Available: true,
				Variations: []models.ProductVariation{
					{SquareID: LatteEspresso, Name: "Espresso", Price: usd(850), Sellable: true, SquareVersion: 1},
					{SquareID: LatteMatcha, Name: "Matcha", Price: usd(850), Sellable: true, Ordinal: 1, SquareVersion: 1},
				},
				ModifierLists: []payments.ItemModifierList{{ListID: MilkList}, {ListID: AddOnsList}},
			},
			{
				ID: SyrupItem, Version: 1, Name: "Housemade Ube Syrup", CategoryNames: []string{"Pantry"}, Available: true,
				Variations: []models.ProductVariation{{SquareID: SyrupRegular, Name: "Regular", Price: usd(1600), Sellable: true}},
			},
		},
	}
}

// SyncCatalog loads Catalog() (or fake.Catalog if already set) into the
// cache through the real catalog service.
func SyncCatalog(t testing.TB, store *database.Store, fake *paymentstest.Fake) *catalog.Service {
	t.Helper()
	if len(fake.Catalog.Items) == 0 {
		fake.Catalog = Catalog()
	}
	svc := catalog.New(store, fake, Logger())
	if _, err := svc.Sync(context.Background()); err != nil {
		t.Fatal(err)
	}
	return svc
}

// NewUser creates a customer account.
func NewUser(t testing.TB, app core.App, email, name string) (models.UserID, *core.Record) {
	t.Helper()
	users, err := app.FindCollectionByNameOrId(database.UsersCollection)
	if err != nil {
		t.Fatal(err)
	}
	// Test-only raw record access: account creation goes through
	// PocketBase's own auth API in the application.
	rec := core.NewRecord(users)
	rec.SetEmail(email)
	rec.SetPassword("correct horse battery staple")
	rec.Set("name", name)
	if err := app.Save(rec); err != nil {
		t.Fatal(err)
	}
	return models.UserID(rec.Id), rec
}
