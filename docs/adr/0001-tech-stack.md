# ADR 0001: Tech stack, and why there's no ORM

**Status:** Accepted
**Date:** 2026-09-18

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
- **SQLite via Node's built-in `node:sqlite` module**, with a hand-written
  schema (`db/schema.sql`) and a thin repository layer
  (`src/lib/repositories/*.ts`) instead of an ORM.
- **No `next/font/google`** — a system font stack instead.

## Why no ORM (specifically: why not Prisma)

The first version of this app used Prisma, which is the default choice for
a TypeScript + SQLite app and was the right starting point. It was dropped
after `prisma generate` failed in this project's own build environment:
Prisma's CLI downloads a native query/schema-engine binary from
`binaries.prisma.sh` on first run, and that host was unreachable —
blocked outright by network policy, not a transient failure.

That's a useful stand-in for a class of real constraints: locked-down
corporate CI runners, air-gapped build environments, and increasingly
common "default-deny" egress policies all produce the exact same failure.
An engineering choice that only works when a specific third-party CDN is
reachable is a hidden dependency on that CDN's uptime and your network
policy's goodwill — worth surfacing explicitly rather than discovering it
during an incident.

Given that, the options were: fight the network policy (the proxy this
project's dev environment runs behind explicitly says not to — see its
README: "do not retry or route around it, report the blocked host"), switch
to Prisma's WASM/driver-adapter mode (still fetches a compiler artifact,
same class of risk, more moving parts), or drop the native-binary
dependency entirely. Node 22 ships `node:sqlite` built in — zero downloads,
zero postinstall steps, zero native compilation. For an app with three
tables and a handful of queries, that's a good trade.

**What this costs**, honestly:

- No migration-diffing tool. Schema changes are hand-written SQL, applied
  idempotently (`CREATE TABLE IF NOT EXISTS`) rather than versioned
  migrations with up/down scripts. Fine at this scale; would need
  revisiting (a real migration runner, e.g. hand-rolled numbered `.sql`
  files applied in order) before a second developer touches this schema
  regularly.
- No generated TypeScript types from the schema. `src/lib/types.ts` is
  hand-written and has to be kept in sync with `db/schema.sql` manually.
  The repository layer (`src/lib/repositories/`) is the one place that
  translates between SQL rows and those types, so drift shows up as a
  compile error there rather than silently.
- `node:sqlite` is still flagged experimental by Node as of this writing.
  It's stable enough for this app's scale; a production app expecting
  serious concurrent write load should reconsider (or use SQLite through
  `better-sqlite3` / `libsql`, or move to Postgres).

**What this buys**: the entire toolchain — install, `db:seed`, `dev`,
`build`, `test` — runs with zero network access beyond the initial
`npm install`. That's a property worth having independent of the Prisma
incident: it makes CI faster and more reliable, and it means "works on my
machine" isn't quietly hiding a dependency on a third-party service being
up.

## Why no Google Fonts

Same category of problem, smaller stakes: `next/font/google` fetches font
files from `fonts.googleapis.com` at build time, and that host was also
unreachable in this environment. A system font stack (`-apple-system`,
`Segoe UI`, `Roboto`, `Helvetica`, `Arial`) costs nothing to build, nothing
to load, and is unlikely to be a differentiator for a bakery's brand next
to the actual photography and copy. If custom typography matters later,
`next/font/local` (self-hosted font files, no build-time fetch) is the
option that keeps the build hermetic.

## Alternatives considered

- **Drizzle ORM**: a lighter-weight TypeScript ORM that can sit on top of
  `node:sqlite` directly. Reasonable alternative; not used here mainly to
  keep the dependency count minimal for an app this size — the hand-written
  repository layer is small enough (~150 lines total) that an ORM's
  query-builder ergonomics weren't worth another dependency.
- **Postgres (e.g. via a hosted provider)**: overkill for a single-operator
  bakery's order volume, and adds an external service dependency (and a
  monthly bill) this project doesn't need yet. Worth revisiting if the
  business scales to multiple locations or needs concurrent multi-admin
  writes.
