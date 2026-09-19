package cmd

import (
	"errors"
	"fmt"
	"strings"

	"github.com/pocketbase/pocketbase/core"
	"github.com/spf13/cobra"

	"felisa-cafe/backend/internal/database"
	"felisa-cafe/backend/internal/providers/payments/square"
	"felisa-cafe/backend/internal/services/catalog"
	"felisa-cafe/backend/internal/services/orders"
)

func catalogCommand(app core.App, store *database.Store, catalogSvc *catalog.Service, squareClient *square.Client) *cobra.Command {
	root := &cobra.Command{
		Use:   "catalog",
		Short: "Square catalog cache commands",
	}

	root.AddCommand(&cobra.Command{
		Use:   "sync",
		Short: "Pull the Square catalog into the PocketBase product cache (full, idempotent)",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := prepare(app, store); err != nil {
				return err
			}
			res, err := catalogSvc.Sync(cmd.Context())
			if err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), "catalog synced:", res)
			if len(res.Uncategorized) > 0 {
				fmt.Fprintf(cmd.OutOrStdout(), "no menu category for: %s (assign a Square category, or set one in the admin UI)\n",
					strings.Join(res.Uncategorized, ", "))
			}
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "seed-sandbox",
		Short: "Write the starter menu into a Square SANDBOX catalog, then sync (refuses production)",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if squareClient == nil {
				return errors.New("SQUARE_ACCESS_TOKEN is not set")
			}
			if err := prepare(app, store); err != nil {
				return err
			}
			if err := squareClient.SeedSandboxCatalog(cmd.Context(), sandboxModifierLists, sandboxItems); err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), "sandbox catalog seeded")
			res, err := catalogSvc.Sync(cmd.Context())
			if err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), "catalog synced:", res)
			return nil
		},
	})

	root.AddCommand(&cobra.Command{
		Use:   "seed-pantry-sandbox",
		Short: "Write pantry items into a Square SANDBOX catalog, then sync (refuses production)",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if squareClient == nil {
				return errors.New("SQUARE_ACCESS_TOKEN is not set")
			}
			if err := prepare(app, store); err != nil {
				return err
			}
			if err := squareClient.SeedSandboxCatalog(cmd.Context(), nil, sandboxItemsInCategory("Pantry")); err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), "sandbox pantry catalog seeded")
			res, err := catalogSvc.Sync(cmd.Context())
			if err != nil {
				return err
			}
			fmt.Fprintln(cmd.OutOrStdout(), "catalog synced:", res)
			return nil
		},
	})
	return root
}

func ordersCommand(app core.App, store *database.Store, ordersSvc *orders.Service) *cobra.Command {
	root := &cobra.Command{
		Use:   "orders",
		Short: "Order commands",
	}
	root.AddCommand(&cobra.Command{
		Use:   "reconcile",
		Short: "Re-read recent unsettled orders from Square (recovers from missed webhooks)",
		RunE: func(cmd *cobra.Command, _ []string) error {
			if err := prepare(app, store); err != nil {
				return err
			}
			n, err := ordersSvc.Reconcile(cmd.Context())
			if err != nil {
				return err
			}
			fmt.Fprintf(cmd.OutOrStdout(), "reconciled %d orders\n", n)
			return nil
		},
	})
	return root
}
