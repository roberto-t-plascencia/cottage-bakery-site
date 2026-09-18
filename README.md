# Cottage Bakery Site

A marketing site + direct-order system for a California Class A Cottage
Food Operation: menu, order request flow (pickup / local delivery /
in-state shipping), and a single-admin order dashboard.

This project has two purposes at once. It's meant to actually run a real
home bakery's ordering — and it's built as a deliberately thorough example
of the engineering practices around a small app (documented decisions,
tests where they earn their keep, a CI pipeline, container builds, a
genuine service boundary), not just the app itself. `docs/adr/` has the
reasoning behind the choices below, including how the database layer
changed twice and how a single Next.js app became two independently
deployable services — worth reading if you're curious how "the Prisma
ORM I planned to use turned out to be unreachable in this sandbox" and
"I've always preferred microservices to a monolith" both turn into
actual architecture decisions instead of a workaround or an assertion.

## Repo layout

Two independently-deployable services, one repo — see
[`CLAUDE.md`](CLAUDE.md) for the map and
[ADR 0004](docs/adr/0004-service-boundary.md) for why (short version:
this is over-engineering for what a home bakery actually needs, kept
deliberately for the skill-building value — the ADR says so plainly).

- **`web/`** — Next.js 16 (App Router) + TypeScript + Tailwind. The
  frontend and the only thing the browser ever talks to.
- **`api/`** — Express + TypeScript. Owns Supabase (Postgres + Storage —
  see [ADR 0001](docs/adr/0001-tech-stack.md) for how the data layer got
  here) and admin auth. The only thing that talks to the database.
- **`specs/`** — [`openapi.yaml`](specs/openapi.yaml), the contract
  between them, and [`ENGINEERING_RULES.md`](specs/ENGINEERING_RULES.md),
  the conventions both services follow.

## Getting started

Requires Node 22+, Docker (for the one-command path below), and a
Supabase project (free tier is fine).

1. **Create a Supabase project** at [supabase.com](https://supabase.com) if
   you don't have one.
2. **Run the schema migration**: open your project's SQL Editor and paste
   in the contents of `api/supabase/migrations/0001_init.sql`, then run
   it. (Or, with the Supabase CLI linked to your project:
   `supabase db push` from `api/`.)
3. **Create the Storage bucket**: Storage → New bucket → name it
   `product-images` → mark it **Public** (see `api/src/lib/storage.ts`
   for why public is the right call here — product photos aren't
   sensitive).
4. **Get your API credentials**: Project Settings → API → copy the
   Project URL and the `service_role` secret key (not the `anon` key —
   see `api/src/lib/supabase.ts` for why). These go in `api/.env`
   only — `web/` never sees them.

### Run both services with Docker Compose (recommended)

```bash
cp api/.env.example api/.env   # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
                                # ADMIN_PASSWORD, and a generated JWT_SECRET
cd api && npm install && npm run db:seed && cd ..   # populate the menu once
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... ADMIN_PASSWORD=... \
JWT_SECRET=$(openssl rand -base64 32) \
  docker compose up --build
```

`web/` is at http://localhost:3000, `api/` at http://localhost:4000.
Admin dashboard: `/admin` on `web/`, password from `ADMIN_PASSWORD`.

### Run each service directly (faster iteration)

```bash
# Terminal 1
cd api
npm install
cp .env.example .env    # fill in the same values as above
npm run db:seed
npm run dev              # http://localhost:4000

# Terminal 2
cd web
npm install
cp .env.example .env    # API_URL=http://localhost:4000 (the default)
npm run dev              # http://localhost:3000
```

### Making it your bakery

1. Edit `api/src/lib/config.ts` **and** `web/src/lib/config.ts` — business
   name, contact info, county, CFO registration number, fulfillment
   options. (Yes, both files — see
   [`specs/ENGINEERING_RULES.md`](specs/ENGINEERING_RULES.md)
   "Duplicated code, on purpose" for why this one's hand-kept in sync
   rather than shared.)
2. Edit `api/src/data/products.seed.ts` — your actual menu, then re-run
   `npm run db:seed` from `api/` (safe to re-run; it upserts by slug).
3. **Product photos**: there's no admin upload UI yet (see "What's not
   built" below) — upload images directly in the Supabase dashboard
   (Storage → `product-images` → upload), copy the public URL it gives
   you, and set it as that product's `imageUrl` in
   `api/src/data/products.seed.ts` (or call `uploadProductImage` from
   `api/src/lib/storage.ts` in a one-off script). Products with no
   `imageUrl` just render without a photo — it's optional.
4. Read `web/src/app/about/page.tsx` — the cottage-food disclosure text
   there is a placeholder. Confirm the exact required wording with your
   county's Environmental Health department before launch.

### What's not built

Being upfront about scope: there's no admin UI for editing the menu or
uploading photos (menu changes go through `api/src/data/products.seed.ts`
and a redeploy/reseed; photos go through the Supabase dashboard
directly, per above). `api/src/lib/storage.ts` has the upload/delete
functions a "manage menu from the admin dashboard" feature would call —
it's just not wired to a form or an `api/` route yet. Worth building
once the bakery is placing enough real orders that editing a TypeScript
file to change the menu feels like friction rather than "fine, it's
rare."

## Scripts

Run from inside `web/` or `api/` — each service has its own
`package.json`, on purpose (see ADR 0004).

| Command | What it does |
| --- | --- |
| `npm run dev` | Local dev server |
| `npm run build` | Production build |
| `npm start` | Run a production build |
| `npm test` | Unit (both) + route (`api/` only) tests, via Vitest |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run gen:types` | Regenerate TypeScript types from `specs/openapi.yaml` |
| `npm run db:seed` | `api/` only — seed/update the menu from `products.seed.ts` |

Both services' `lint`, `typecheck`, `test`, and `build` run in CI on
every push, path-filtered per service — see `.github/workflows/ci.yml`.

## Running with Docker

See "Run both services with Docker Compose" above for the full command.
No local volume for either service — Supabase is the persistence layer,
so both containers are fully disposable. See `docker-compose.yml` and
each service's `Dockerfile`.

## Project docs

- [`CLAUDE.md`](CLAUDE.md) — repo map (start here)
- [`specs/openapi.yaml`](specs/openapi.yaml) — the web↔api HTTP contract
- [`specs/ENGINEERING_RULES.md`](specs/ENGINEERING_RULES.md) — cross-service
  conventions (money, dates, error shape, auth, testing, commit style)
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the two services
  fit together
- [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md) — what's tested
  and, as importantly, what isn't and why
- [`docs/adr/`](docs/adr) — Architecture Decision Records:
  1. [Tech stack, and how the database layer got here](docs/adr/0001-tech-stack.md)
  2. [Order model: request-to-fulfill, not online checkout](docs/adr/0002-order-fulfillment-model.md)
  3. [Admin auth: one shared password, not a user system](docs/adr/0003-admin-auth.md)
  4. [Service boundary: web/ and api/ as separate deployables, in one repo](docs/adr/0004-service-boundary.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup + PR expectations,
  written as if a second engineer were about to join

## Legal note

California's Cottage Food Program permits Class A operations to sell
direct-to-consumer online, including in-state shipping — see ADR 0002 for
specifics and sourcing. This isn't legal advice; confirm your own
county's requirements before relying on this app for a real business.
