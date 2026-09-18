# Cottage Bakery Site

A marketing site + direct-order system for a California Class A Cottage
Food Operation: menu, order request flow (pickup / local delivery /
in-state shipping), and a single-admin order dashboard.

This project has two purposes at once. It's meant to actually run a real
home bakery's ordering — and it's built as a deliberately thorough example
of the engineering practices around a small app (documented decisions,
tests where they earn their keep, a CI pipeline, a container build), not
just the app itself. `docs/adr/` has the reasoning behind the choices
below, including how the database layer changed twice over the course of
building this — worth reading if you're curious how "the Prisma ORM I
planned to use turned out to be unreachable in this sandbox" turns into an
actual architecture decision instead of a workaround.

## Stack

- **Next.js 16 (App Router) + TypeScript + Tailwind CSS**
- **Supabase** (Postgres + Storage) for the database and product photos —
  see [ADR 0001](docs/adr/0001-tech-stack.md) for the full story of how
  the data layer got here (it wasn't the first choice, or the second)
- **Vitest** for unit tests of the business logic
- **Docker** (multi-stage, `output: "standalone"`) for deployment

## Getting started

Requires Node 22+, and a Supabase project (free tier is fine).

1. **Create a Supabase project** at [supabase.com](https://supabase.com) if
   you don't have one.
2. **Run the schema migration**: open your project's SQL Editor and paste
   in the contents of `supabase/migrations/0001_init.sql`, then run it.
   (Or, with the Supabase CLI linked to your project: `supabase db push`.)
3. **Create the Storage bucket**: Storage → New bucket → name it
   `product-images` → mark it **Public** (see `src/lib/storage.ts` for
   why public is the right call here — product photos aren't sensitive).
4. **Get your API credentials**: Project Settings → API → copy the
   Project URL and the `service_role` secret key (not the `anon` key —
   see `src/lib/supabase.ts` for why).

```bash
npm install
cp .env.example .env          # fill in SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
                               # ADMIN_PASSWORD, SESSION_SECRET
npm run db:seed               # populates the menu from src/data/products.seed.ts
npm run dev                   # http://localhost:3000
```

Admin dashboard: `/admin`, password from `ADMIN_PASSWORD` in `.env`.

### Making it your bakery

1. Edit `src/lib/config.ts` — business name, contact info, county, CFO
   registration number, fulfillment options.
2. Edit `src/data/products.seed.ts` — your actual menu, then re-run
   `npm run db:seed` (safe to re-run; it upserts by slug).
3. **Product photos**: there's no admin upload UI yet (see "What's not
   built" below) — upload images directly in the Supabase dashboard
   (Storage → `product-images` → upload), copy the public URL it gives
   you, and set it as that product's `imageUrl` in
   `src/data/products.seed.ts` (or `uploadProductImage` in
   `src/lib/storage.ts` from a one-off script). Products with no
   `imageUrl` just render without a photo — it's optional.
4. Read `src/app/about/page.tsx` — the cottage-food disclosure text there
   is a placeholder. Confirm the exact required wording with your county's
   Environmental Health department before launch.

### What's not built

Being upfront about scope: there's no admin UI for editing the menu or
uploading photos (menu changes go through `products.seed.ts` and a
redeploy/reseed; photos go through the Supabase dashboard directly, per
above). `src/lib/storage.ts` has the upload/delete functions a "manage
menu from the admin dashboard" feature would call — it's just not wired
to a form yet. Worth building once the bakery is placing enough real
orders that editing a TypeScript file to change the menu feels like
friction rather than "fine, it's rare."

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
SUPABASE_URL=https://your-project-ref.supabase.co \
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key \
ADMIN_PASSWORD=your-password \
SESSION_SECRET=$(openssl rand -base64 32) \
  docker compose up --build
```

No local volume — Supabase is the persistence layer, so the container
itself is fully disposable. See `docker-compose.yml` and the `Dockerfile`
comment on why the build stage needs a placeholder Supabase URL/key even
though it never talks to a real project.

## Project docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the app fits
  together
- [`docs/TESTING_STRATEGY.md`](docs/TESTING_STRATEGY.md) — what's tested
  and, as importantly, what isn't and why
- [`docs/adr/`](docs/adr) — Architecture Decision Records:
  1. [Tech stack, and how the database layer got here](docs/adr/0001-tech-stack.md)
  2. [Order model: request-to-fulfill, not online checkout](docs/adr/0002-order-fulfillment-model.md)
  3. [Admin auth: one shared password, not a user system](docs/adr/0003-admin-auth.md)
- [`CONTRIBUTING.md`](CONTRIBUTING.md) — local setup + PR expectations,
  written as if a second engineer were about to join

## Legal note

California's Cottage Food Program permits Class A operations to sell
direct-to-consumer online, including in-state shipping — see ADR 0002 for
specifics and sourcing. This isn't legal advice; confirm your own
county's requirements before relying on this app for a real business.
