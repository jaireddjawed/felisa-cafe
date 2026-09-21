# Felisa Cafe

A Filipino-American coffee bar storefront: browse the menu, build a drink,
and pay — as a guest or with an account.

One Laravel application. Laravel renders React pages through Inertia, so there
is no API between the backend and its own frontend, and nothing deploys
separately.

| System                   | Role                                                                 |
| ------------------------ | -------------------------------------------------------------------- |
| **Square**               | Source of truth for the catalog, prices, taxes, orders and payments. |
| **Laravel + PostgreSQL** | Customers, the cached catalog, local order history, ETA.             |
| **Inertia + React**      | The storefront itself.                                               |

```
Square Catalog ──square:sync-catalog──▶ products ──▶ MenuController ──▶ React menu
                                                                          │
                              cart (session: IDs and quantities only) ◀────┘
                                          │
                       CreateCheckout: re-price, re-verify against Square
                                          │
                       Square order ──▶ PayOrder (Web Payments SDK token)
                                          │
              HandleSquareWebhook ──▶ Order: paid → preparing → ready → completed
```

## Getting started

Prerequisites: PHP 8.3+, Composer, Node 20+, PostgreSQL.

```bash
composer install
npm install

cp .env.example .env
php artisan key:generate

createdb felisa_cafe
createdb felisa_cafe_testing      # the test suite runs on PostgreSQL too
php artisan migrate --seed        # seeds the real menu

composer dev                      # server + queue + logs + vite
```

The storefront is at http://localhost:8000. The menu, cart and accounts all
work without Square; only checkout needs it.

## Commands

|                                       |                                            |
| ------------------------------------- | ------------------------------------------ |
| `composer dev`                        | Run the app (server, queue, logs, Vite)    |
| `composer test`                       | Pint, PHPStan and the full test suite      |
| `php artisan test`                    | Tests only                                 |
| `composer types:check`                | PHPStan / Larastan                         |
| `npm run types:check`                 | TypeScript                                 |
| `npm run check`                       | Lint and format check (JS/TS/CSS)          |
| `composer lint` / `npm run check:fix` | Apply formatting                           |
| `npm run build`                       | Production assets                          |
| `php artisan square:sync-catalog`     | Pull the Square catalog into products      |
| `php artisan square:reconcile-orders` | Re-read unsettled orders (missed webhooks) |

## Square setup

Without `SQUARE_ACCESS_TOKEN` the storefront still runs; checkout reports that
it is unavailable.

1. In the [Square Developer Dashboard](https://developer.squareup.com/apps),
   create an application and open its **Sandbox** credentials. Put the sandbox
   access token in `SQUARE_ACCESS_TOKEN` and the application ID in
   `SQUARE_APPLICATION_ID` — the latter is public and used by the card form.
2. Copy the sandbox **location ID** into `SQUARE_LOCATION_ID`.
3. Build the menu in the Square sandbox dashboard, then:
    ```bash
    php artisan square:sync-catalog
    ```
    Items are matched to the seeded products by name, so Square's prices attach
    to the existing copy and pour colors instead of duplicating them.
4. Pay with Square's
   [sandbox test cards](https://developer.squareup.com/docs/devtools/sandbox/payments),
   e.g. `4111 1111 1111 1111`, any future expiry, any CVV.

### Webhooks in development

1. Expose the local server, e.g. `cloudflared tunnel --url http://localhost:8000`.
2. In the Developer Dashboard → Webhooks (Sandbox), subscribe
   `https://<tunnel>/webhooks/square` to `payment.created`, `payment.updated`,
   `order.updated`, `order.fulfillment.updated` and `catalog.version.updated`.
3. Set `SQUARE_WEBHOOK_URL` to that exact URL (it is part of the signed
   payload) and `SQUARE_WEBHOOK_SIGNATURE_KEY` to the subscription's key.

Without webhooks, orders still settle when the customer opens the order page,
and `square:reconcile-orders` catches the rest. Webhooks just make it immediate.

## How it is put together

- **Actions** (`app/Actions/`) hold the business operations: `SyncSquareCatalog`,
  `CreateCheckout`, `PayOrder`, `CalculateOrderEta`, `HandleSquareWebhook`.
  Each one reads top to bottom and queries Eloquent directly.
- **Controllers** are thin: validate, call an Action, return an Inertia response.
- **`app/Square/`** is the only place that talks to Square. It speaks the v2
  REST API through Laravel's HTTP client, so tests use `Http::fake()` against
  real Square payloads.
- **Money is always integer cents.** No floats anywhere near a price.

### Guarantees worth knowing

- **Prices are never taken from the browser.** The cart holds Square variation
  and modifier IDs plus quantities. Everything else is resolved server-side,
  and checkout re-reads prices from Square before charging. Any disagreement
  aborts.
- **Paid means Square says paid.** A browser reaching the confirmation page
  proves nothing; it only triggers a re-read.
- **Retries are safe.** The customer's idempotency key maps to one local order.
  The key sent to Square is derived from that order and the request is rebuilt
  from it, so a retry after a timeout replays rather than duplicating.
- **Webhooks are idempotent and order-independent.** Handled event IDs are
  recorded, payload contents are never trusted, and a stale version is ignored.
- **Order history is a snapshot.** Line items keep the name, options and prices
  from the moment of purchase.

## Testing

```bash
php artisan test
```

Square is never contacted: `Http::preventStrayRequests()` turns any unfaked
request into a failure. Coverage includes catalog sync and its idempotency,
cart validation, guest and account checkout, checkout idempotency, Square
failure handling, webhook signatures and replay, order authorization, price
snapshots, and the ETA algorithm.

## Production notes

- Set `SQUARE_ENVIRONMENT=production`, and the webhook signature key and URL.
- Schedule `square:sync-catalog` and `square:reconcile-orders` (see
  `routes/console.php`).
- Run `php artisan square:sync-catalog` once after deploying.
- Refunds are handled in Square; the local projection does not track them yet.

### Render test deployment

The repository includes a Docker-based `render.yaml` that provisions a free
web service and Postgres database. Create a Render Blueprint from the repo and
provide the prompted values for `APP_KEY`, `APP_URL`, and the Square settings.
Generate the application key locally with:

```bash
php artisan key:generate --show
```

Set `SQUARE_WEBHOOK_URL` to `https://<your-service>.onrender.com/webhooks/square`
and use that exact URL for the Square webhook subscription. The free Blueprint
does not add Render Cron Jobs, so Square webhooks handle prompt updates and the
catalog can be synced manually with `php artisan square:sync-catalog`.
