# Architecture

One-page map of how this app is put together and why. For the reasoning
behind specific decisions, see `docs/adr/`.

## Overview

```
                        ┌─────────────────────────┐
                        │        Browser           │
                        │  (cart lives here only:   │
                        │   localStorage, via       │
                        │   useSyncExternalStore)    │
                        └───────────┬───────────────┘
                                    │ HTTP
                        ┌───────────▼───────────────┐
                        │   Next.js App Router        │
                        │                              │
   read paths           │  Server Components           │  write paths
   (/, /menu, /about,   │  read src/lib/repositories    │  (submit order,
    /admin, confirm)    │  directly — no API hop        │   admin login,
                        │                              │   status change)
                        │  API routes                   │──┐
                        │  (src/app/api/**/route.ts)     │  │ writes go through
                        └───────────┬───────────────┘  │ the same repositories
                                    │                       │ + server-side
                        ┌───────────▼───────────────┐  │ validation
                        │  src/lib/repositories/*.ts   │◄─┘
                        │  (the only code that touches  │
                        │   SQL)                        │
                        └───────────┬───────────────┘
                                    │
                        ┌───────────▼───────────────┐
                        │  SQLite (node:sqlite)        │
                        │  db/schema.sql                │
                        └───────────────────────────┘

        src/proxy.ts gates every /admin/* request before any of the
        above runs, redirecting to /admin/login if there's no valid
        session cookie (src/lib/auth.ts).
```

## Directory layout

```
db/
  schema.sql        Hand-written SQL schema (see ADR 0001 for why no ORM)
  seed.ts           Populates the menu from src/data/products.seed.ts

src/
  app/              Next.js App Router — pages and API routes
    api/             Route handlers: orders, admin login/logout, order status
    admin/           Admin dashboard (server component) + login page
    order/           Cart/checkout (client) + confirmation page (server)
    menu/ about/ contact/   Marketing pages
  components/        Shared UI (Header, Footer, ProductCard, admin widgets)
  lib/
    config.ts         Single source of truth for bakery business info
    cart.ts            Pure cart math — no framework, no I/O, fully unit-tested
    orders.ts          Server-side order validation (business + legal rules)
    auth.ts            Admin password check + session cookie signing
    db.ts              node:sqlite connection singleton
    types.ts            Hand-written domain types (see ADR 0001)
    repositories/       The only files that write SQL
  proxy.ts           Route guard for /admin/*

tests/unit/          Vitest tests for the pure-logic modules
docs/                This file, plus docs/adr/ and docs/TESTING_STRATEGY.md
```

## Key design choices, briefly

- **Server Components read the database directly.** `/menu` and `/admin`
  don't fetch their own API — they call the repository layer in the
  render function. The API routes exist specifically for client-side
  mutations (submitting an order, changing a status), where there's no
  other way to get data from the browser to the server. Not every data
  access needs to go through a REST layer; the REST layer earns its place
  where a client actually needs to push a write.
- **The repository layer is the only code that writes SQL.** Every page
  and route calls `src/lib/repositories/{products,orders}.ts`, never
  `db.prepare(...)` directly. That's the seam where a future schema change
  or a swap to a different database gets contained instead of scattered
  across a dozen files.
- **Business/legal rules live in `src/lib/orders.ts`, not in the API route
  or the form component.** The checkout form does light client-side
  validation for immediate feedback; `validateOrder` is the actual source
  of truth, called server-side, and is pure enough to unit-test without a
  server or a database.
- **Money is always integer cents**, never floating-point dollars — avoids
  an entire class of rounding bugs in totals.
- **Two auth layers for `/admin`**: `src/proxy.ts` handles the UI
  redirect, and each admin API route independently re-verifies the
  session. Belt and suspenders, not redundancy — see ADR 0003.
