// Package payments is the payment processor boundary: a PaymentProcessor
// interface plus each concrete provider (currently Square, in square.go and
// square_catalog.go). Call sites (see internal/actions/catalog_sync.go)
// should depend on the interface rather than a concrete provider, so
// switching providers later means writing one new implementation here
// instead of touching the rest of the backend.
package payments

import (
	"context"

	"felisa-cafe/backend/internal/models"
)

// CatalogSyncResult is the outcome of syncing one product with the payment
// processor: its slug, and the processor-assigned catalog item ID to cache
// on the PocketBase record's catalog_id field.
type CatalogSyncResult struct {
	Slug      string
	CatalogID string
}

// PaymentProcessor is implemented by each supported payment processor.
type PaymentProcessor interface {
	// SyncCatalog creates or updates each product's catalog item with the
	// processor and returns the catalog ID to persist on the record.
	SyncCatalog(ctx context.Context, products []*models.Product) ([]CatalogSyncResult, error)
}
