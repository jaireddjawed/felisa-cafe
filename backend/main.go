package main

import (
	"log"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/plugins/migratecmd"

	_ "felisa-cafe/backend/internal/migrations"
	"felisa-cafe/backend/internal/routes"
)

func main() {
	app := pocketbase.New()

	migratecmd.MustRegister(app, app.RootCmd, migratecmd.Config{
		Automigrate: true,
	})

	routes.Register(app)

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
