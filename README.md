# Cottage Bakery Site

A marketing site + direct-order system for a California Class A Cottage
Food Operation: menu, order request flow (pickup / local delivery /
in-state shipping), and a single-admin order dashboard.

This project has two purposes at once. It's meant to actually run a real
home bakery's ordering — and it's built as a deliberately thorough example
of the engineering practices around a small app (documented decisions,
tests where they earn their keep, a CI pipeline, a container build), not
just the app itself. `docs/adr/` has the reasoning behind the choices
below, including a couple of things that had to change mid-build because
of constraints in the environment this was built in — worth reading if
you're curious how "the Prisma ORM I planned to use turned out to be
unreachable in this sandbox" turns into an actual architecture decision
instead of a workaround.

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS**
- **SQLite via `node:sqlite`** (Node's built-in module — no ORM, no native
  binary to install; see [ADR 0001](docs/adr/0001-tech-stack.md))
- **Vitest** for unit tests of the business logic
- **Docker** (multi-stage, `output: "standalone"`) for deployment

## Getting started

Requires Node 22+ (for `node:sqlite`).

```bash
npm install
cp .env.example .env          # then edit ADMIN_PASSWORD / SESSION_SECRET
npm run db:seed               # populates the menu from src/data/products.seed.ts
npm run dev                   # http://localhost:3000
```

Admin dashboard: `/admin`, password from `ADMIN_PASSWORD` in `.env`.

### Making it your bakery

1. Edit `src/lib/config.ts` — business name, contact info, county, CFO
   registration number, fulfillment options.
2. Edit `src/data/products.seed.ts` — your actual menu, then re-run
   `npm run db:seed` (safe to re-run; it upserts by slug).
3. Read `src/app/about/page.tsx` — the cottage-food disclosure text there
   is a placeholder. Confirm the exact required wording with your county's
   Environmental Health department before launch.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm start` | Run a production build |
| `npm test` | Unit tests (Vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:seed` | Seed/update the menu from `src/data/products.seed.ts` |

`npm run lint`, `typecheck`, `test`, and `build` all run in CI on every
push — see `.github/workflows/ci.yml`.

## Running with Docker

```bash
ADMIN_PASSWORD=your-password SESSION_SECRET=$(openssl rand -base64 32) \
  docker compose up --build
```

Orders persist in a named Docker volume across restarts/rebuilds — see
`docker-compose.yml`.

## Project docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app fits
  together
- [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md) — what's tested
  and, as importantly, what isn't and why
- [`docs/adr/`](docs/adr) — Architecture Decision Records:
  1. [Tech stack, and why there's no ORM](docs/adr/0001-tech-stack.md)
  2. [Order model: request-to-fulfill, not online checkout](docs/adr/0002-order-fulfillment-model.md)
  3. [Admin auth: one shared password, not a user system](docs/adr/0003-admin-auth.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup + PR expectations,
  written as if a second engineer were about to join

## Legal note

California's Cottage Food Program permits Class A operations to sell
direct-to-consumer online, including in-state shipping — see ADR 0002 for
specifics and sourcing. This isn't legal advice; confirm your own
county's requirements before relying on this app for a real business.
