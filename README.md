# Felisa Cafe

A Filipino-American coffee bar storefront.

- **`frontend/`** — Next.js (App Router) + React + TypeScript + Tailwind CSS v4. PocketBase auth via session cookies. See `frontend/AGENTS.md` before making changes — this is a newer Next.js with breaking changes from what you may know.
- **`backend/`** — Go + PocketBase (framework mode) with Square as the source of truth for catalog, prices, orders and payments. PocketBase is the app DB, auth, admin UI and product cache, behind a generated, typed persistence layer. Checkout goes through Square-hosted payment links; payment is confirmed only by Square (verified webhooks / Orders API). **See [`backend/README.md`](backend/README.md)** for the architecture, env vars, Square sandbox setup, and webhook testing.

## Getting started

```bash
# backend (see backend/README.md for Square setup; runs without it too)
cd backend && set -a && source .env && set +a && go run . serve --dir ./pb_data
# or, from frontend/: npm run backend:dev

# frontend (in another terminal)
cd frontend && npm install && npm run dev
```

Frontend: http://localhost:3000 · PocketBase dashboard: http://localhost:8090/_/

## Type generation

Backend: `go generate ./...` (from `backend/`) regenerates the typed PocketBase layer from the migrations. Run it after every migration change; see `backend/README.md`.

From `frontend/`, `npm run typegen` regenerates:
- `lib/pocketbase-types.ts` from the live PocketBase schema (`pocketbase-typegen`)
- `lib/api-types.ts` from the Go actions' wire types (`tygo`, config in `backend/tygo.yaml`)

## Deploying

Each app deploys as its own Fly.io app — `fly deploy` from within `frontend/` or `backend/` respectively (see the `fly.toml` in each).
