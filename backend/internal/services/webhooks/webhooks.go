// Package webhooks processes verified Square webhook events.
//
// Delivery is at-least-once and unordered, so processing is idempotent at
// two levels: event IDs already handled are skipped, and handling itself
// never trusts the event payload's state; it re-reads the order from
// Square (orders.SyncFromSquare), which converges regardless of order or
// repetition.
package webhooks

import (
	"context"
	"errors"
	"log/slog"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

// OrderSyncer re-reads an order from Square (orders.Service).
type OrderSyncer interface {
	SyncFromSquare(ctx context.Context, id models.SquareOrderID) (models.Order, error)
}

// CatalogSyncer schedules a catalog resync (catalog.Service).
type CatalogSyncer interface {
	TriggerSync()
}

type Service struct {
	store   *database.Store
	orders  OrderSyncer
	catalog CatalogSyncer
	log     *slog.Logger
}

func New(store *database.Store, orders OrderSyncer, catalog CatalogSyncer, log *slog.Logger) *Service {
	return &Service{store: store, orders: orders, catalog: catalog, log: log}
}

// Handle processes one verified event. A returned error means "not
// processed": the HTTP layer answers non-2xx and Square redelivers later.
func (s *Service) Handle(ctx context.Context, ev *payments.WebhookEvent) error {
	seen, err := s.store.WebhookEvents.Seen(ctx, ev.ID)
	if err != nil {
		return err
	}
	if seen {
		s.log.Debug("duplicate webhook ignored", "event", ev.ID, "type", ev.Type)
		return nil
	}

	switch ev.Kind {
	case payments.WebhookOrderChanged:
		_, err := s.orders.SyncFromSquare(ctx, ev.OrderID)
		switch {
		case errors.Is(err, models.ErrNotFound):
			// Not an online order (e.g. an in-store POS sale): nothing to do.
		case err != nil:
			return err
		}
	case payments.WebhookCatalogChanged:
		s.catalog.TriggerSync()
	}

	return s.store.WebhookEvents.MarkProcessed(ctx, ev.ID, ev.Type)
}
