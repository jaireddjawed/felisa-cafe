// Package cmd wires the application together and defines its CLI commands
// (on top of PocketBase's own: serve, migrate, superuser, ...).
package cmd

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"time"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	"felisa-cafe/backend/internal/actions"
	"felisa-cafe/backend/internal/config"
	"felisa-cafe/backend/internal/database"
	_ "felisa-cafe/backend/internal/migrations"
	"felisa-cafe/backend/internal/providers/payments"
	"felisa-cafe/backend/internal/providers/payments/square"
	"felisa-cafe/backend/internal/routes"
	"felisa-cafe/backend/internal/services/cart"
	"felisa-cafe/backend/internal/services/catalog"
	"felisa-cafe/backend/internal/services/checkout"
	"felisa-cafe/backend/internal/services/eta"
	"felisa-cafe/backend/internal/services/orders"
	"felisa-cafe/backend/internal/services/webhooks"
)

// Run builds and starts the application.
func Run() error {
	log := slog.New(slog.NewTextHandler(os.Stderr, nil))

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("configuration: %w", err)
	}

	// Interfaces stay untyped-nil when Square is off, so services can test
	// for "not configured" with a plain nil check.
	var (
		squareClient *square.Client
		catalogAPI   payments.Catalog
		checkoutAPI  payments.Checkout
		webhookAPI   payments.Webhooks
	)
	if cfg.Square != nil {
		if squareClient, err = square.New(*cfg.Square); err != nil {
			return err
		}
		catalogAPI, checkoutAPI, webhookAPI = squareClient, squareClient, squareClient
	} else {
		log.Warn("SQUARE_ACCESS_TOKEN is not set: serving the cached menu only; checkout and catalog sync are disabled")
	}

	app := pocketbase.New()
	store := database.New(app)

	estimator := eta.NewQueueEstimator(cfg.ETA, store.Orders)
	catalogSvc := catalog.New(store, catalogAPI, log)
	cartSvc := cart.New(store)
	ordersSvc := orders.New(store, checkoutAPI, estimator, log)
	checkoutSvc := checkout.New(checkout.Config{PublicSiteURL: cfg.PublicSiteURL},
		store, cartSvc, catalogAPI, checkoutAPI, estimator, catalogSvc.TriggerSync, log)
	webhookSvc := webhooks.New(store, ordersSvc, catalogSvc, log)

	// Schema changes are made in Go migrations (the typed layer is generated
	// from them), so dashboard edits are not auto-captured as JS migrations.
	// `go run . migrate create <name>` scaffolds a new Go migration.
	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Dir:          "internal/migrations",
		TemplateLang: migratecmd.TemplateLangGo,
		Automigrate:  false,
	})

	// Registered before the routes so a schema mismatch stops `serve`
	// before any request is handled.
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		if err := store.Verify(); err != nil {
			return err
		}
		return se.Next()
	})

	routes.Register(app, &actions.Handlers{
		Catalog:       catalogSvc,
		Carts:         cartSvc,
		Checkout:      checkoutSvc,
		Orders:        ordersSvc,
		Webhooks:      webhookSvc,
		ETA:           estimator,
		WebhookParser: webhookAPI,
		Log:           log,
	})

	if squareClient != nil {
		scheduleJobs(app, cfg, catalogSvc, ordersSvc, log)
	}

	app.RootCmd.AddCommand(
		catalogCommand(app, store, catalogSvc, squareClient),
		ordersCommand(app, store, ordersSvc),
	)
	return app.Start()
}

// scheduleJobs registers background reconciliation. Webhooks are the fast
// path; these jobs make the system converge even if webhooks are lost.
func scheduleJobs(app core.App, cfg config.Config, catalogSvc *catalog.Service, ordersSvc *orders.Service, log *slog.Logger) {
	if cfg.CatalogSyncCron != "" {
		app.Cron().MustAdd("felisa_catalog_sync", cfg.CatalogSyncCron, catalogSvc.TriggerSync)
	}
	if cfg.OrderReconcileCron != "" {
		app.Cron().MustAdd("felisa_order_reconcile", cfg.OrderReconcileCron, func() {
			ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
			defer cancel()
			n, err := ordersSvc.Reconcile(ctx)
			if err != nil {
				log.Error("order reconciliation failed", "error", err)
				return
			}
			if n > 0 {
				log.Info("orders reconciled with square", "count", n)
			}
		})
	}
}

// prepare readies the database for a CLI command: `serve` applies
// migrations itself, other commands must do it explicitly.
func prepare(app core.App, store *database.Store) error {
	if err := app.RunAllMigrations(); err != nil {
		return fmt.Errorf("migrations: %w", err)
	}
	return store.Verify()
}
