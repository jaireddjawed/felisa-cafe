// Package database is the typed persistence boundary. It is the only
// package allowed to touch PocketBase records (via the generated proxies in
// internal/database/internal/schema, which Go's internal-package rule makes
// unreachable from anywhere else). Everything it exports speaks
// internal/models types.
package database

import (
	"context"

	"github.com/pocketbase/pocketbase/core"

	"felisa-cafe/backend/internal/database/internal/schema"
	"felisa-cafe/backend/internal/models"
)

// Store bundles the repositories over one core.App (or one transaction).
type Store struct {
	app core.App

	Products      ProductRepo
	Carts         CartRepo
	Orders        OrderRepo
	WebhookEvents WebhookEventRepo
	Users         UserRepo
}

func New(app core.App) *Store {
	return &Store{
		app:           app,
		Products:      newProductRepo(app),
		Carts:         CartRepo{carts: table[schema.CartsRecord, *schema.CartsRecord]{app}},
		Orders:        OrderRepo{orders: table[schema.OrdersRecord, *schema.OrdersRecord]{app}},
		WebhookEvents: WebhookEventRepo{events: table[schema.WebhookEventsRecord, *schema.WebhookEventsRecord]{app}},
		Users:         UserRepo{users: table[schema.UsersRecord, *schema.UsersRecord]{app}},
	}
}

// RunInTx runs fn with a Store bound to a single database transaction.
// PocketBase serializes write transactions, so read-modify-write sequences
// inside fn cannot interleave with other writers.
func (s *Store) RunInTx(ctx context.Context, fn func(tx *Store) error) error {
	return s.app.RunInTransaction(func(txApp core.App) error {
		if err := ctx.Err(); err != nil {
			return err
		}
		return fn(New(txApp))
	})
}

// Verify fails if the live PocketBase schema differs from what the
// generated code assumes. Call it once the app is bootstrapped and
// migrated, before serving traffic.
func (s *Store) Verify() error {
	return schema.Verify(s.app)
}

// UserIDFromAuth extracts the customer ID from a request's authenticated
// record, if (and only if) it is a "users" auth record. HTTP actions pass
// core.RequestEvent.Auth straight through without inspecting it.
func UserIDFromAuth(auth *core.Record) (models.UserID, bool) {
	if auth == nil || auth.Collection() == nil || auth.Collection().Name != schema.UsersCollection {
		return "", false
	}
	return models.UserID(auth.Id), true
}

// UsersCollection is the auth collection customers sign in to, for route
// middleware such as apis.RequireAuth.
const UsersCollection = schema.UsersCollection
