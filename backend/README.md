# Felisa Cafe backend

Go + [PocketBase](https://pocketbase.io) (v0.40, framework mode) + [Square](https://developer.squareup.com) (official Go SDK v4).

| System | Role |
| --- | --- |
| **Square** | Source of truth for the catalog, prices, taxes, orders, payments and fulfillment. |
| **PocketBase** | App database, customer auth, admin UI, product **cache**, cart storage, local order projection. |
| **`internal/services`** | Business logic. |
| **`internal/actions`** | HTTP boundary (thin). |
| **`internal/providers`** | External systems (Square). |
| **`internal/database`** | Typed persistence layer. The **only** code allowed to touch PocketBase records. |

```
Square Catalog ──sync──▶ PocketBase cache ──▶ menu API ──▶ cart (IDs only, priced server-side)
                                                              │
                         revalidate prices with Square ◀──────┘
                                   │
         local order (pending_payment, line-item snapshot) ──▶ Square Order + payment link
                                                                        │
                    customer pays on Square-hosted checkout ◀───────────┘
                                   │
   verified webhook / Orders API read ──▶ local order: paid → preparing → ready → completed
```

## Layout

```
main.go                         → internal/cmd.Run()
internal/
  cmd/            app wiring, CLI commands (catalog sync, orders reconcile, ...)
  config/         environment configuration
  routes/         route table
  actions/        HTTP handlers: parse → call a service → render
  views/          JSON wire types (+ source of frontend/lib/api-types.ts)
  services/
    catalog/      menu reads (from cache) + Square → cache sync
    cart/         server-side carts, pricing and modifier validation
    checkout/     cart → Square order + payment link, idempotently
    orders/       order history, authorization, Square → local projection
    eta/          pickup time estimation
    webhooks/     verified webhook dispatch + replay protection
  providers/payments/
    payments.go   provider-neutral interfaces and types
    square/       Square SDK implementation (the only importer of the SDK)
    paymentstest/ in-memory fake used by tests
  database/       typed repositories (Products, Carts, Orders, WebhookEvents, Users)
    internal/schema/  GENERATED typed record proxies + hand-written support
  models/         domain types: Money (int64 minor units), Product, Cart, Order, ...
  migrations/     PocketBase migrations (the schema source of truth)
  tools/pbgen/    the schema code generator
  tokens/         opaque token creation/hashing
  testutil/       test fixtures
```

## Typed PocketBase persistence

Application code never sees `*core.Record`, never calls `record.GetString("…")`,
and never spells a collection or field name. It uses repositories that speak
domain types:

```go
products, err := store.Products.ListByCategories(ctx, models.CategorySignature, models.CategoryMatcha)
order, err := store.Orders.FindByIdempotencyKey(ctx, key)
err := store.RunInTx(ctx, func(tx *database.Store) error { ... })
```

How it is built:

1. **Migrations are the schema.** `internal/migrations/*.go` define every collection.
2. **`pbgen` generates typed proxies from them.** It boots a throwaway PocketBase
   in a temp dir, applies all migrations, reads the resulting collections and writes
   `internal/database/internal/schema/schema_gen.go`:
   - `ProductsRecord` (embeds `core.BaseRecordProxy`) with typed getters/setters
     (`Slug() string`, `SetCategory(ProductsCategory)`, `ModifierLists() ([]ProductModifierListRef, error)`),
   - typed IDs per collection (`ProductsID`); relations use them (`ProductVariationsRecord.Product() ProductsID`),
   - enums for select fields (`OrdersStatusPaid`, `OrdersStatusValues`),
   - typed columns for queries (`schema.Orders.Status.In(...)`, `schema.Orders.PaidAt.Gt(t)`),
   - a `CollectionSpec` per collection used by `Verify`.
   JSON fields need a Go type declared in `schema/pbgen.json` (`jsonTypes`); an
   unmapped JSON field or unsupported field type fails generation.
3. **A small generic core** (`database/table.go`): `table[R, P]` provides
   `New/Save/Delete/FindByID/Query().Where(...).OrderBy(...).All/One`, built on
   PocketBase's `RecordQuery`, which scans straight into the generated proxies.
   `enumMapping[D, S]` maps domain enums ⇄ schema enums.
4. **Repositories** (`database/*.go`) convert proxies ⇄ `internal/models` types.
   A `models.Product` is an aggregate (product row + variation rows + referenced
   modifier lists), loaded in three queries and saved as one unit.

What guards it:

- **Compile time:** the generated package lives under `internal/database/internal/`, so the
  Go toolchain rejects any import of it from services, actions or routes. Removing or
  retyping a field or select option in a migration and regenerating makes every use of it
  in the repositories fail to compile.
- **Tests:** `TestGeneratedSchemaIsUpToDate` fails when a migration changed without
  regenerating; `TestEnumMappingsAreExhaustive` fails when a new select option has no
  domain mapping.
- **Startup:** `serve` and the app's own CLI commands (`catalog …`, `orders …`) run `schema.Verify`, which compares the
  live database to the generated specs and refuses to start on drift, e.g. a collection
  edited in the admin UI.

### Regenerating

After changing or adding a migration:

```bash
go generate ./...        # rewrites internal/database/internal/schema/schema_gen.go
go test ./...            # enum exhaustiveness + generated-code freshness
```

Then update the repositories that the compiler points at. Never edit `schema_gen.go` by hand.

### The remaining raw boundary (intentional, small)

- `internal/migrations/` uses raw names, because it *defines* the schema. It must not
  import app models or the generated layer; old migrations are frozen history.
- `internal/database/internal/schema/` is the generated code and its support file.
- `database.UserIDFromAuth` receives the request's `*core.Record` auth record from
  `actions` (passed through untouched) and is the only place that reads it.
- The `database` package's own tests mutate collections by name to simulate drift, and
  `testutil.NewUser` sets a user's `name` directly (test-only; the app creates users through
  PocketBase's auth API).
- Query ordering strings come from typed columns (`Column.Asc()`), but dbx itself is
  string-based. A column name typo can't happen because names are generated.

## Local development

Prerequisites: Go 1.27 (`mise install` at the repo root), optionally the Square
sandbox (see below).

```bash
cd backend
cp .env.example .env            # fill in, or leave Square empty for a Square-less run
set -a && source .env && set +a

go run . serve                  # http://127.0.0.1:8090 (API) · http://127.0.0.1:8090/_/ (admin)
go run . superuser upsert you@example.com 'a-long-password'   # admin UI login
```

`serve` applies pending migrations, verifies the schema, and starts the cron jobs
(catalog sync every 30 min, order reconciliation every 5 min) when Square is configured.

From `frontend/`, `npm run backend:dev` runs the same `serve` against `backend/pb_data`.

### Environment variables

| Variable | Required | Default | Purpose |
| --- | --- | --- | --- |
| `SQUARE_ACCESS_TOKEN` | for Square | – | Square access token. Unset = no checkout/sync. |
| `SQUARE_ENVIRONMENT` | | `sandbox` | `sandbox` or `production` |
| `SQUARE_LOCATION_ID` | with token | – | The location orders are placed at and prices/availability resolve for. |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | production | – | Webhook subscription signature key. |
| `SQUARE_WEBHOOK_URL` | production | – | The subscription's notification URL, exactly as registered. |
| `SQUARE_TIMEOUT` | | `15s` | Per-call Square timeout. |
| `SQUARE_ALLOW_TIPPING` | | `false` | Offer tipping on the hosted checkout. |
| `SQUARE_CURRENCY` | | `USD` | Currency for prices without an explicit one. |
| `PUBLIC_SITE_URL` | | `http://localhost:3000` | Storefront origin; Square redirects to `/orders/{id}`. Must be https in production. |
| `ETA_BASE_PREP` / `ETA_PER_ITEM` / `ETA_BUFFER` / `ETA_CAPACITY` | | `2m` / `90s` / `2m` / `2` | Pickup estimate assumptions. |
| `CATALOG_SYNC_CRON` / `ORDER_RECONCILE_CRON` | | `*/30 * * * *` / `*/5 * * * *` | Background jobs; empty disables. |

Secrets are read only from the environment and are never logged.

### Square sandbox setup

1. In the [Square Developer Dashboard](https://developer.squareup.com/apps) create an
   application and open its **Sandbox** credentials. Copy the sandbox access token into
   `SQUARE_ACCESS_TOKEN`.
2. Copy the default sandbox **location ID** (Locations tab) into `SQUARE_LOCATION_ID`.
3. Seed a starter menu into the *sandbox* catalog and pull it into PocketBase:
   ```bash
   go run . catalog seed-sandbox     # refuses to run against production
   ```
   (Or build the menu in the Square sandbox dashboard and run `go run . catalog sync`.)
4. Pay on the hosted checkout with Square's
   [sandbox test cards](https://developer.squareup.com/docs/devtools/sandbox/payments),
   e.g. `4111 1111 1111 1111`, any future expiry, any CVV.

## Migrations

- Schema changes are **Go migrations** in `internal/migrations/`. Scaffold one with
  `go run . migrate create <name>`, then run `go generate ./...`.
- Don't change the schema in the admin UI: dashboard edits aren't captured as migrations
  (automigrate is off), and `serve` will refuse to start on the resulting drift.
- `go run . migrate up|down` applies/reverts manually; `serve` applies pending ones.
- `1700000007_commerce_schema` upgrades databases created by the earlier scaffold in place:
  legacy float prices become integer cents, and old statuses are mapped.

## Catalog synchronization

`go run . catalog sync` performs a full, idempotent reconciliation:

- products are matched by Square item ID. On first contact, a Square item is matched
  to an existing unlinked local product by name or slug, which adopts its
  presentation metadata instead of duplicating it,
- variations are upserted by Square variation ID; removed ones are deleted,
- modifier lists are replaced wholesale,
- items archived in Square or not offered at `SQUARE_LOCATION_ID` become `archived`;
  items no longer returned by Square become `deleted`. Neither is ever hard-deleted, so
  local metadata survives if the item returns.

Field ownership:

| Owned by Square (overwritten by sync) | Owned locally (edit in the admin UI) |
| --- | --- |
| name, description*, variations and prices, modifier lists and limits, availability, category** | slug, tagline, ingredients, size, pour colors, badge, sort order |

\* An empty Square description doesn't erase local copy. \*\* Square category names
are mapped by keyword (`"Matcha Series"` → `matcha`); if none matches, the locally set
category is kept.

Sync also runs on the `catalog.version.updated` webhook (coalesced, in the background),
on the cron schedule, and whenever checkout detects that the cache disagrees with Square.

## Storefront API

| Method & path | Auth | Notes |
| --- | --- | --- |
| `GET /api/menu/products[?category=signature,matcha]` | – | From cache; never calls Square. |
| `GET /api/menu/products/{slug}` | – | |
| `GET /api/cart` | cart token or user | |
| `POST /api/cart/items` `{variationId, modifierIds, quantity, note}` | – | Issues `cartToken` to new guests. IDs only, never prices. |
| `PATCH /api/cart/items/{lineId}` `{quantity}` / `DELETE …` | cart token or user | `quantity: 0` removes. |
| `POST /api/cart/merge` | user + `X-Cart-Token` | Folds the guest cart in after sign-in. |
| `GET /api/cart/eta` | cart token or user | Estimated pickup time if ordered now. |
| `POST /api/checkout` `{customerName, customerEmail, customerPhone?, notes?}` | cart token or user; **`Idempotency-Key`** header | → `{orderId, checkoutUrl, orderToken?, estimatedReadyAt, total}`. Redirect to `checkoutUrl`. |
| `GET /api/orders` | user | Order history. |
| `GET /api/orders/{id}` | owner, or guest `X-Order-Token` | Anyone else gets 404. Refreshes from Square while unsettled. |
| `POST /api/webhooks/square` | Square signature | |

Guests send `X-Cart-Token`; signed-in customers send their PocketBase auth token
(`Authorization`). Typed client wrappers live in `frontend/lib/pocketbase.ts`.

## Checkout and payment guarantees

- **Prices are never trusted from the client.** Carts store Square variation/modifier IDs
  and quantities. Checkout prices them from the cache, then **re-reads them from Square**
  (`BatchRetrieveCatalogObjects`). Any difference aborts with 409 and triggers a resync.
  If Square can't be reached, checkout is refused with 503; browsing is unaffected. The
  Square order itself references catalog IDs, so Square computes the final price and taxes.
- **Idempotency.** The client's `Idempotency-Key` maps to exactly one local order. The
  Square `CreatePaymentLink` idempotency key is `felisa-order-{localOrderID}`, and the
  request is rebuilt byte-for-byte from the persisted order, so a retry after a timeout
  (success remotely, response lost) returns the original Square order.
- **Paid means Square says paid.** The redirect back from Square only triggers a re-read.
  An order becomes `paid` only from a signature-verified webhook or a direct Orders API
  read showing tenders that cover the amount due.
- **Webhooks are idempotent and order-independent.** Processed event IDs are recorded, and
  processing never trusts the payload's state. It re-reads the order from Square, guarded
  by Square's order version. Events for orders that aren't ours (in-store POS sales) are
  acknowledged without an API call. Unprocessable events return 500, so Square redelivers.
- **Missed webhooks are recovered** by `ORDER_RECONCILE_CRON` (or `go run . orders reconcile`),
  which re-reads unsettled orders from the last 48h.
- **Guest orders** are protected by a 256-bit access token returned once at checkout; only
  its SHA-256 is stored. Account orders are visible only to their owner.
- **History is a snapshot.** Line items store name, variation, modifiers and prices at
  purchase time. The totals shown are Square's (including tax).

Status projection from Square: no full payment → `pending_payment`; paid + fulfillment
`PROPOSED` → `paid`; `RESERVED` → `preparing`; `PREPARED` → `ready`; `COMPLETED` or
order completed → `completed`; canceled → `cancelled`. Staff drive fulfillment in
Square POS / Dashboard as usual.

## Pickup time estimates

See `internal/services/eta`. Each paid, not-yet-ready order is work in the queue:
`ETA_BASE_PREP + ETA_PER_ITEM × drinks`. Only signature and matcha items count as drinks;
pantry and merch need no preparation. `ETA_CAPACITY` baristas work the queue FIFO in
parallel. A new order is scheduled behind the queue, `ETA_BUFFER` is added, and the
result is rounded up to the minute. The estimate is shown at checkout and recomputed
against the queue at the moment payment is confirmed. It's sent to Square as the pickup
fulfillment's prep time.

Known simplifications: in-progress orders count as a full unit of work, walk-in POS
orders aren't in the queue, and business hours aren't modeled. Replace
`eta.QueueEstimator` behind the `eta.Estimator` interface to improve it.

## Webhooks in development

1. Expose the local server, e.g. `cloudflared tunnel --url http://127.0.0.1:8090` or
   `ngrok http 8090`.
2. In the Developer Dashboard → Webhooks (Sandbox), add a subscription to
   `https://<tunnel>/api/webhooks/square` for `payment.created`, `payment.updated`,
   `order.updated`, `order.fulfillment.updated` and `catalog.version.updated`.
3. Set `SQUARE_WEBHOOK_URL` to that exact URL and `SQUARE_WEBHOOK_SIGNATURE_KEY` to the
   subscription's signature key, then restart `serve`.
4. Use **Send test event** in the dashboard, or pay a sandbox checkout. Deliveries with a bad
   signature get 401 and are logged without their body.

Without webhooks, orders still settle through the order-view refresh and the reconcile
job; webhooks just make it immediate.

## Testing

```bash
go test ./...
go vet ./...
gofmt -l .                                                # should print nothing
go run honnef.co/go/tools/cmd/staticcheck@latest ./...   # optional; not a module dependency
```

Tests run against real, freshly migrated PocketBase databases in temp dirs, with Square
replaced by `paymentstest.Fake`. The Square provider is tested against an `httptest`
server speaking Square's JSON. Coverage includes the typed persistence layer, schema
drift detection, generated-code freshness, catalog sync, cart pricing and modifier rules,
checkout idempotency (including lost responses), stale-price refusal, webhook
replay/ordering, order authorization, reconciliation, ETA scheduling, and the HTTP routes.

## Production notes

- Deploy with `fly deploy` from this directory; set secrets with
  `fly secrets set SQUARE_ACCESS_TOKEN=… SQUARE_LOCATION_ID=… SQUARE_ENVIRONMENT=production SQUARE_WEBHOOK_SIGNATURE_KEY=… SQUARE_WEBHOOK_URL=https://<api-host>/api/webhooks/square PUBLIC_SITE_URL=https://<storefront>`.
  Startup fails if production is missing webhook settings or uses a non-https site URL.
- SQLite lives on one volume, so run a single machine (as `fly.toml` already does). Enable
  PocketBase backups in the admin UI.
- Enable PocketBase's built-in rate limiter (Settings → Rate limits), particularly for
  `/api/checkout` and `/api/cart/*`, and restrict CORS with `serve --origins=https://<storefront>`.
- Run `go run . catalog sync` once after deploying, and after bulk catalog edits if you
  don't subscribe to `catalog.version.updated`.
- Refunds are handled in Square; the local projection doesn't track them yet (see TODOs).
