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
                        │  (the only code that talks to  │
                        │   Supabase)                    │
                        └───────────┬───────────────┘
                                    │ supabase-js (service_role key,
                                    │ server-only — see src/lib/supabase.ts)
                        ┌───────────▼───────────────┐
                        │  Supabase                   │
                        │  Postgres (orders, products)  │
                        │  Storage (product photos)     │
                        └───────────────────────────┘

        src/proxy.ts gates every /admin/* request before any of the
        above runs, redirecting to /admin/login if there's no valid
        session cookie (src/lib/auth.ts).
```

## Directory layout

```
db/
  seed.ts           Populates the menu from src/data/products.seed.ts

supabase/
  migrations/        Hand-written Postgres SQL (schema, RLS, the
                      create_order_with_items function) — see ADR 0001
                      for why there's no ORM and no diff-based migration
                      tool.

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
    supabase.ts         Server-only Supabase client (service_role key)
    storage.ts          Product photo upload/URL helpers (Supabase Storage)
    types.ts            Hand-written domain types (see ADR 0001)
    repositories/       The only files that call supabase-js
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
- **The repository layer is the only code that calls `supabase-js`.**
  Every page and route calls `src/lib/repositories/{products,orders}.ts`,
  never the Supabase client directly. That's the seam where the database
  layer has already been swapped twice (see ADR 0001) without touching
  any page or route beyond adding `await`.
- **The Supabase client uses the `service_role` key, server-side only,**
  guarded by the `server-only` package (`src/lib/supabase.ts`) so
  importing it from client code is a build error. There's no direct
  client-side Supabase access anywhere in this app — the browser only
  ever talks to this app's own API routes. Row Level Security is enabled
  on every table as defense-in-depth for a future client-side feature,
  not something the current request flow depends on (see the migration
  file's comment).
- **Creating an order is one atomic Postgres function call**
  (`create_order_with_items`), not two client-side inserts — see ADR 0001
  chapter 3 for why PostgREST needed that instead of a hand-rolled
  transaction.
- **Business/legal rules live in `src/lib/orders.ts`, not in the API route
  or the form component.** The checkout form does light client-side
  validation for immediate feedback; `validateOrder` is the actual source
  of truth, called server-side, and is pure enough to unit-test without a
  server or a database.
- **Money is always integer cents**, never floating-point dollars — avoids
  an entire class of rounding bugs in totals.
- **Dates that are calendar dates, not instants** (`requestedDate`) are
  parsed and formatted through `parseDateOnly`/`formatDateOnly`/
  `toDateInputValue` in `src/lib/cart.ts`, never `new Date(dateOnlyString)`
  directly — see that file's comments for the off-by-one-day bug this
  avoids across timezones.
- **Two auth layers for `/admin`**: `src/proxy.ts` handles the UI
  redirect, and each admin API route independently re-verifies the
  session. Belt and suspenders, not redundancy — see ADR 0003.
