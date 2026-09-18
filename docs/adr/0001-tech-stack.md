# ADR 0001: Tech stack, and how the database layer got here

**Status:** Accepted (superseding an earlier decision in the same ADR — see below)
**Date:** 2026-09-18 (updated same day: Prisma → node:sqlite → Supabase)

## Context

This is a small marketing + direct-order site for a single-operator Class A
Cottage Food Operation. The requirements are modest: a handful of content
pages, a menu backed by a database, an order form that writes to that
database, and a single-admin dashboard to manage incoming orders. It needs
to be cheap to run, easy for one person to maintain, and — because it
doubles as a job-search portfolio piece — built the way a careful engineer
would build it, not the fastest way to a demo.

## Decision

- **Next.js (App Router) + TypeScript + Tailwind CSS** for the app itself.
  Server Components read the database directly for pages; a small number
  of API routes exist specifically where a client needs to *mutate* state
  (submitting an order, updating an order's status, admin login).
- **Supabase (Postgres + Storage)** as the database and file-storage
  provider, reached from a thin repository layer
  (`src/lib/repositories/*.ts`) — no ORM.
- **No `next/font/google`** — a system font stack instead.

This ADR went through three real iterations in the course of building this
app, each forced by a concrete constraint rather than a hypothetical one.
The history is kept here instead of quietly rewritten, because *why* the
data layer looks the way it does is more instructive than just the final
answer — and because "the requirements changed mid-build, here's how the
architecture adapted" is a more honest story than pretending the final
shape was obvious from the start.

## Chapter 1: Prisma, then blocked

The first version used Prisma, the default choice for a TypeScript +
SQLite app. It was dropped after `prisma generate` failed in this
project's own build sandbox: Prisma's CLI downloads a native
query/schema-engine binary from `binaries.prisma.sh` on first run, and
that host was unreachable — blocked outright by network policy, not a
transient failure. That's a useful stand-in for a class of real
constraints: locked-down corporate CI runners, air-gapped build
environments, and increasingly common "default-deny" egress policies all
produce the same failure. An engineering choice that only works when a
specific third-party CDN is reachable is a hidden dependency on that CDN's
uptime and your network policy's goodwill.

## Chapter 2: node:sqlite, to unblock the build

Rather than fight the network policy (the build sandbox's own proxy
explicitly says not to route around a blocked host — report it instead)
or switch to Prisma's WASM mode (still fetches a compiler artifact, same
class of risk), the app moved to Node 22's built-in `node:sqlite` module:
zero downloads, zero postinstall steps, zero native compilation. For an
app with three tables, that was a good trade at the time — the entire
toolchain (`install`, `db:seed`, `dev`, `build`, `test`) ran with zero
network access beyond the initial `npm install`.

That version is preserved in this repo's git history (and briefly in an
earlier draft of this ADR) rather than described further here, because it
was explicitly a single-file, single-process, single-container answer:
good for unblocking a build, not the right shape for a real deployment
one person can access from a phone, a laptop, and an admin dashboard, all
persisting to the same data.

## Chapter 3: Supabase, for the real deployment

Once the app needed to actually run somewhere durable — reachable from
more than one machine, with product photos that need real file storage,
not just a URL field with nothing behind it — a single SQLite file inside
one container stopped being the right fit. Its data lives and dies with
that one container's disk; there's no story for backups, for a second
admin, or for images without bolting on a separate object-storage service
anyway. Supabase (managed Postgres + Storage, with a generous free tier)
solves both problems in one connection: a real hosted database, and a
Storage bucket for product photos (`src/lib/storage.ts`), without standing
up separate infrastructure for each.

**What changed in the code:**

- `db/schema.sql` (SQLite DDL) became `supabase/migrations/0001_init.sql`
  (Postgres DDL) — real enum types instead of CHECK-constrained text,
  `uuid` primary keys generated server-side, `timestamptz`/`date` instead
  of hand-formatted ISO strings, and an `updated_at` trigger instead of
  setting it in application code.
- `src/lib/db.ts` (a `node:sqlite` connection singleton) became
  `src/lib/supabase.ts` (a Supabase client, built from
  `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`, guarded with the
  `server-only` package so it's a build error to ever import it from
  client code — the service-role key bypasses Row Level Security and must
  never reach the browser).
- The repository layer (`src/lib/repositories/{products,orders}.ts`) was
  rewritten against `supabase-js` instead of raw `db.prepare(...)` calls
  — but every page and route that *calls* the repositories didn't change
  shape, only `async`/`await`. That's the payoff of the repository seam
  from chapter 2: the rest of the app never knew or cared what was on the
  other side of `src/lib/repositories/`, so swapping the database
  underneath it a second time touched only that one layer (plus the
  now-async call sites — see `docs/ARCHITECTURE.md`).
- Creating an order and its line items has to be atomic — a half-written
  order (order row present, items missing) is a corrupt order, not a
  partial one. `node:sqlite`'s version did this with a hand-rolled
  `BEGIN`/`COMMIT`/`ROLLBACK`; PostgREST (what `supabase-js` talks to)
  doesn't expose ad-hoc multi-table transactions over its REST API, so
  Supabase's version does it as a single Postgres function
  (`create_order_with_items` in the migration) instead — a function body
  runs in one implicit transaction, so either both inserts land or
  neither does.

**What this costs**, honestly:

- A real network dependency at runtime, where `node:sqlite` had none. The
  app now can't run fully offline, and an outage on Supabase's side is an
  outage for this app. That's a normal, accepted tradeoff for a real
  multi-device deployment — unlike the Prisma incident (chapter 1), this
  is a build-vs-runtime distinction: `next build` still needs no live
  Supabase project (see the comment in `Dockerfile` and `.github/workflows/ci.yml`
  for how the build gets past constructing a client without one), only
  the *running* app needs network access to Supabase, which is exactly
  the same category of dependency any hosted-database choice has.
- Still no migration-diffing tool day to day — `supabase/migrations/` is
  hand-written SQL, applied via the Supabase SQL Editor or
  `supabase db push`. The Supabase CLI can generate migrations from a
  linked project's schema diff; not wired up here to keep the tool
  surface small for a single-operator project, worth adopting if a
  second developer starts changing this schema regularly.
- Row Level Security is enabled on every table but currently has no
  policies, because every request that reaches Supabase already went
  through this app's own server-side auth (proxy + repository layer) —
  see the comment in the migration file. That's intentional, but it means
  RLS isn't yet pulling its own weight as a second line of defense; if a
  client-side Supabase feature is ever added (e.g. real-time order
  updates via `supabase-js` in the browser), real policies need to be
  written before that ships, not after.

**What this buys**: the same app, the same repository-layer abstraction,
now backed by a database that survives a redeploy, is reachable from
everywhere, and comes with file storage for product photos built in — the
actual requirements of a bakery someone might really use this for.

## Why no Google Fonts

Same category of problem as chapter 1, smaller stakes: `next/font/google`
fetches font files from `fonts.googleapis.com` at build time, and that
host was also unreachable in the original build sandbox. A system font
stack (`-apple-system`, `Segoe UI`, `Roboto`, `Helvetica`, `Arial`) costs
nothing to build, nothing to load, and is unlikely to be a differentiator
for a bakery's brand next to the actual photography and copy. If custom
typography matters later, `next/font/local` (self-hosted font files, no
build-time fetch) is the option that keeps the build hermetic.

## Alternatives considered (for chapter 3)

- **Neon / PlanetScale / other managed Postgres**: reasonable
  alternatives with a similar free-tier-friendly story. Supabase was
  chosen because Storage (for product photos) and Postgres come from the
  same project/connection instead of needing a second service for files.
- **Drizzle or another lightweight ORM on top of Postgres**: still a
  reasonable choice; not used here for the same reason as chapter 2 — the
  hand-written repository layer stays small enough (a few hundred lines
  total) that an ORM's query-builder ergonomics aren't yet worth another
  dependency. Worth revisiting if the schema grows substantially more
  complex.
