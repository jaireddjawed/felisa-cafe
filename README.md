# Felisa Cafe

A Filipino-American coffee bar storefront.

- **`frontend/`** — Next.js (App Router) + React + TypeScript + Tailwind CSS v4. PocketBase auth via session cookies. See `frontend/AGENTS.md` before making changes — this is a newer Next.js with breaking changes from what you may know.
- **`backend/`** — PocketBase (Go, framework mode): `products`/`orders` collections, migrations, a `/api/checkout` controller that re-prices line items server-side.

## Getting started

```bash
# backend
cd backend && go run . serve --dir ./pb_data
# or, from frontend/: npm run backend:dev

# frontend (in another terminal)
cd frontend && npm install && npm run dev
```

Frontend: http://localhost:3000 · PocketBase dashboard: http://localhost:8090/_/

## Type generation

From `frontend/`, `npm run typegen` regenerates:
- `lib/pocketbase-types.ts` from the live PocketBase schema (`pocketbase-typegen`)
- `lib/api-types.ts` from the Go controllers' wire types (`tygo`, config in `backend/tygo.yaml`)

## Deploying

Each app deploys as its own Fly.io app — `fly deploy` from within `frontend/` or `backend/` respectively (see the `fly.toml` in each).
