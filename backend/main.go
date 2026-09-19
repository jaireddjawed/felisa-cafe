// Felisa Cafe backend: PocketBase (app DB, auth, admin UI, product cache)
// with Square as the source of truth for catalog, orders and payments.
// See README.md for the architecture.
package main

import (
	"log"

	"felisa-cafe/backend/internal/cmd"
)

func main() {
	if err := cmd.Run(); err != nil {
		log.Fatal(err)
	}
}
