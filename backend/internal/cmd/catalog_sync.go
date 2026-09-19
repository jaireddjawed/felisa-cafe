package cmd

import (
	"fmt"

	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cobra"

	"felisa-cafe/backend/internal/models"
	"felisa-cafe/backend/internal/providers/payments"
)

// CatalogSyncCommand returns the `catalog:sync` console command: it pushes
// every signature/matcha product into newProcessor's catalog and writes the
// returned catalog ID back onto each PocketBase record's catalog_id field.
// newProcessor is called lazily (only when the command actually runs) so
// that missing processor credentials don't block `serve` or other commands.
func CatalogSyncCommand(app core.App, newProcessor func() (payments.PaymentProcessor, error)) *cobra.Command {
	return &cobra.Command{
		Use:   "catalog:sync",
		Short: "Push signature/matcha products into the payment processor's catalog",
		RunE: func(cmd *cobra.Command, args []string) error {
			processor, err := newProcessor()
			if err != nil {
				return err
			}

			records, err := app.FindRecordsByFilter(
				"products", "category = 'signature' || category = 'matcha'", "+name", 200, 0, nil,
			)
			if err != nil {
				return fmt.Errorf("load products: %w", err)
			}

			products := make([]*models.Product, len(records))
			recordBySlug := make(map[string]*core.Record, len(records))
			for i, r := range records {
				p, err := models.ProductFromRecord(r)
				if err != nil {
					return fmt.Errorf("read product %s: %w", r.Id, err)
				}
				products[i] = p
				recordBySlug[p.Slug] = r
			}

			results, err := processor.SyncCatalog(cmd.Context(), products)
			if err != nil {
				return err
			}

			for _, res := range results {
				record, ok := recordBySlug[res.Slug]
				if !ok || res.CatalogID == "" || record.GetString("catalog_id") == res.CatalogID {
					continue
				}

				record.Set("catalog_id", res.CatalogID)
				if err := app.Save(record); err != nil {
					return fmt.Errorf("save catalog_id for %s: %w", res.Slug, err)
				}
				fmt.Printf("synced %s -> %s\n", res.Slug, res.CatalogID)
			}

			return nil
		},
	}
}
