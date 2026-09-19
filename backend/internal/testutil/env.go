package testutil

import (
	"sync/atomic"
	"testing"
	"time"

	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/actions"
	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/providers/payments/paymentstest"
	"felisa-cafe/backend/internal/services/cart"
	"felisa-cafe/backend/internal/services/catalog"
	"felisa-cafe/backend/internal/services/checkout"
	"felisa-cafe/backend/internal/services/eta"
	"felisa-cafe/backend/internal/services/orders"
	"felisa-cafe/backend/internal/services/webhooks"
)

// Env is the full service graph over a real (migrated, temporary)
// PocketBase and a fake Square, with the catalog already synced.
type Env struct {
	App      core.App
	Store    *database.Store
	Square   *paymentstest.Fake
	Catalog  *catalog.Service
	Carts    *cart.Service
	Orders   *orders.Service
	Checkout *checkout.Service
	Webhooks *webhooks.Service
	ETA      eta.Estimator

	// StaleCatalogCalls counts checkout's "cache is stale" notifications.
	StaleCatalogCalls atomic.Int32
}

func NewEnv(t testing.TB) *Env {
	t.Helper()
	app := NewApp(t)
	e := &Env{App: app, Store: database.New(app), Square: paymentstest.New()}
	log := Logger()

	e.Catalog = SyncCatalog(t, e.Store, e.Square)
	e.ETA = eta.NewQueueEstimator(eta.Config{BasePrep: 2 * time.Minute, PerItem: time.Minute, Buffer: time.Minute, Capacity: 1}, e.Store.Orders)
	e.Carts = cart.New(e.Store)
	e.Orders = orders.New(e.Store, e.Square, e.ETA, log)
	e.Checkout = checkout.New(checkout.Config{PublicSiteURL: "https://felisa.test"},
		e.Store, e.Carts, e.Square, e.Square, e.ETA, func() { e.StaleCatalogCalls.Add(1) }, log)
	e.Webhooks = webhooks.New(e.Store, e.Orders, e.Catalog, log)
	return e
}

// Handlers returns HTTP handlers over the env, using the fake's webhook
// verification (see paymentstest.ValidSignature).
func (e *Env) Handlers() *actions.Handlers {
	return &actions.Handlers{
		Catalog: e.Catalog, Carts: e.Carts, Checkout: e.Checkout, Orders: e.Orders,
		Webhooks: e.Webhooks, ETA: e.ETA, WebhookParser: e.Square, Log: Logger(),
	}
}
