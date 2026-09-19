package database

import (
	"context"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/database/internal/schema"
	_ "felisa-cafe/backend/internal/migrations"
	"felisa-cafe/backend/internal/models"
)

// newApp mirrors testutil.NewApp (which this internal test can't import).
func newApp(t *testing.T) core.App {
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

// A select option added to a migration regenerates a new schema constant.
// These tests fail until the option is mapped to a domain value, so a new
// option can never reach the database unmapped.
func TestEnumMappingsAreExhaustive(t *testing.T) {
	checkEnum(t, categories, schema.ProductsCategoryValues, models.ProductCategories)
	checkEnum(t, catalogStatuses, schema.ProductsCatalogStatusValues,
		[]models.CatalogStatus{models.CatalogUnlinked, models.CatalogActive, models.CatalogArchived, models.CatalogDeleted})
	checkEnum(t, orderStatuses, schema.OrdersStatusValues, []models.OrderStatus{
		models.OrderPendingPayment, models.OrderPaid, models.OrderPreparing,
		models.OrderReady, models.OrderCompleted, models.OrderCancelled,
	})
}

func checkEnum[D ~string, S ~string](t *testing.T, m enumMapping[D, S], stored []S, domain []D) {
	t.Helper()
	for _, s := range stored {
		d, err := m.FromDB(s)
		if err != nil {
			t.Errorf("schema value %q has no domain mapping", s)
			continue
		}
		if back, _ := m.ToDB(d); back != s {
			t.Errorf("%q does not round-trip (got %q)", s, back)
		}
	}
	for _, d := range domain {
		if _, err := m.ToDB(d); err != nil {
			t.Errorf("domain value %q has no storage mapping", d)
		}
	}
}

// The generic query layer: typed columns, including time comparisons and
// empty IN lists, work against real PocketBase storage.
func TestTypedQueries(t *testing.T) {
	ctx := context.Background()
	app := newApp(t)
	orders := table[schema.OrdersRecord, *schema.OrdersRecord]{app}

	base := time.Date(2026, 9, 1, 8, 0, 0, 0, time.UTC)
	for i, st := range []schema.OrdersStatus{schema.OrdersStatusPaid, schema.OrdersStatusReady, schema.OrdersStatusPaid} {
		rec, err := orders.New()
		if err != nil {
			t.Fatal(err)
		}
		rec.SetStatus(st)
		rec.SetCustomerName("n")
		rec.SetCustomerEmail("n@example.com")
		rec.SetLineItems([]schema.OrderLineItemJSON{{ProductName: "x", Quantity: int64(i + 1)}})
		rec.SetPaidAt(base.Add(time.Duration(i) * time.Hour))
		if err := orders.Save(ctx, rec); err != nil {
			t.Fatal(err)
		}
	}

	paid, err := orders.Query().
		Where(schema.Orders.Status.Eq(schema.OrdersStatusPaid), schema.Orders.PaidAt.Gt(base)).
		OrderBy(schema.Orders.PaidAt.Desc()).
		All(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(paid) != 1 || !paid[0].PaidAt().Equal(base.Add(2*time.Hour)) {
		t.Fatalf("got %d records", len(paid))
	}
	items, err := paid[0].LineItems()
	if err != nil || items[0].Quantity != 3 {
		t.Errorf("json field = %+v, %v", items, err)
	}

	none, err := orders.Query().Where(schema.Orders.Status.In()).All(ctx)
	if err != nil || len(none) != 0 {
		t.Errorf("empty IN should match nothing, got %d, %v", len(none), err)
	}

	unset, err := orders.Query().Where(schema.Orders.User.IsEmpty()).All(ctx)
	if err != nil || len(unset) != 3 {
		t.Errorf("IsEmpty on unset relation matched %d, %v", len(unset), err)
	}
}
