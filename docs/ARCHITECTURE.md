# Architecture

One-page map of how this app is put together and why. For the reasoning
behind specific decisions, see `docs/adr/` — especially
[ADR 0004](adr/0004-service-boundary.md), which is the one that shaped
everything below: two independently-deployable services (`web/`, `api/`)
in one repo, not one Next.js app.

## Overview

```
                        ┌─────────────────────────┐
                        │        Browser           │
                        │  (cart lives here only:   │
                        │   localStorage, via       │
                        │   useSyncExternalStore)    │
                        └───────────┬───────────────┘
                                    │ HTTP — same-origin only.
                                    │ The browser never talks to api/.
                        ┌───────────▼───────────────┐
                        │   web/ — Next.js (BFF)       │
                        │                              │
   read paths           │  Server Components read       │  write paths
   (/, /menu, /about,   │  via apiClient.ts (an HTTP     │  (submit order,
    /admin, confirm)    │  call to api/, not a DB call) │   admin login,
                        │                              │   status change)
                        │  API routes — thin proxies:    │──┐
                        │  parse, forward to api/, relay │  │
                        │  the response. No business      │  │
                        │  logic lives here anymore.       │  │
                        └───────────┬───────────────┘  │
                                    │ HTTP, server-side only    │
                                    │ (Authorization: Bearer     │
                                    │  <JWT> on admin routes —   │
                                    │  web/ never verifies it,   │
                                    │  just forwards it)          │
                        ┌───────────▼───────────────┐  │
                        │   api/ — Express + TypeScript │◄─┘
                        │                              │
                        │  Route handlers (products,    │
                        │  orders, admin) → validation   │
                        │  (src/lib/orders.ts) → the     │
                        │  repository layer               │
                        │                              │
                        │  src/lib/repositories/*.ts —   │
                        │  the ONLY code anywhere in      │
                        │  this system that talks to      │
                        │  Supabase                        │
                        └───────────┬───────────────┘
                                    │ supabase-js (service_role key —
                                    │ only api/ ever holds this)
                        ┌───────────▼───────────────┐
                        │  Supabase                   │
                        │  Postgres (orders, products)  │
                        │  Storage (product photos)     │
                        └───────────────────────────┘

        web/src/proxy.ts gates /admin/* optimistically (cookie present?)
        before any of the above runs — it cannot verify the JWT itself
        (only api/ holds JWT_SECRET). The real authorization check is
        api/'s requireAdmin middleware on every admin route. See ADR 0004.
```

## Directory layout

```
specs/
  openapi.yaml          Single source of truth for the web<->api HTTP
                         contract. Both services generate TypeScript
                         types from this (`npm run gen:types`).
  ENGINEERING_RULES.md   Cross-service conventions — read this before
                         touching either service.

web/
  src/
    app/                Next.js App Router — pages and thin API-proxy routes
      api/               Route handlers: forward to api/, relay the response
      admin/             Admin dashboard (server component) + login page
      order/             Cart/checkout (client) + confirmation page (server)
      menu/ about/ contact/   Marketing pages
    components/          Shared UI (Header, Footer, ProductCard, admin widgets)
    lib/
      config.ts           Bakery business info (duplicated in api/ — see
                           specs/ENGINEERING_RULES.md "Duplicated code")
      cart.ts              Client cart math + date-only helpers, unit-tested
      apiClient.ts          The only file that calls api/ over HTTP
      auth.ts               Just the session cookie's name/TTL — no signing
                           logic lives here anymore (see api/src/lib/auth.ts)
      types.ts              Re-exports from the generated OpenAPI schema
      api-schema.generated.ts   Generated — never hand-edit (see specs/)
    proxy.ts             Optimistic route guard for /admin/*

  tests/unit/            Vitest tests for the pure-logic modules that
                         remain in web/ (cart math, date helpers)

api/
  supabase/migrations/   Hand-written Postgres SQL (schema, RLS, the
                         create_order_with_items function) — see ADR 0001
                         for why there's no ORM and no diff-based migration
                         tool.
  db/seed.ts             Populates the menu from src/data/products.seed.ts
  src/
    index.ts             Process entrypoint (binds a port)
    app.ts                Express app factory — separated from index.ts so
                         route tests can import it without binding a port
    routes/               products, orders, admin — HTTP layer only
    middleware/requireAdmin.ts   The actual authorization check for
                         admin routes (not web/src/proxy.ts — see above)
    lib/
      supabase.ts          The only Supabase client in the whole system
      repositories/         The only code that queries Supabase
      orders.ts             Business/legal order validation, unit-tested
      auth.ts                Password check + JWT issuing/verification
      storage.ts             Product photo upload/URL helpers
      cart.ts, config.ts     Deliberately duplicated subset of web/'s
                           copies — see specs/ENGINEERING_RULES.md
      types.ts               Hand-written domain types (see ADR 0001)
  tests/
    unit/                 Same pure-logic testing as web/'s tests/unit/
    routes/                Integration tests against the real Express
                         app (supertest), repository layer mocked — new
                         since the split, see specs/ENGINEERING_RULES.md

docs/                    This file, docs/adr/, docs/TESTING_STRATEGY.md
```

## Key design choices, briefly

- **The browser only ever talks to `web/`.** `api/` is never reachable
  from client-side code — not by accident (no CORS is configured, so a
  browser request to `api/` would be blocked even if attempted) and not
  by design (the BFF pattern: `web/` is the only client `api/` has to
  think about, which is what lets `api/`'s auth model be "one bearer
  token, checked once" instead of anything session-cookie-aware).
- **`api/src/lib/repositories/*.ts` is the only code that calls
  `supabase-js`,** same instinct as the pre-split app (see ADR 0001) —
  now enforced by a process boundary, not just convention: `web/` has
  no Supabase credentials to misuse even if a bug tried.
- **`web/`'s own API routes are thin proxies now, not business logic.**
  Compare `web/src/app/api/orders/route.ts` before and after this split
  in git history — validation, price lookup, and the actual database
  write all moved to `api/`. What's left in `web/` is "parse the
  request, call `apiClient`, relay the response," which is exactly why
  `specs/ENGINEERING_RULES.md`'s testing rule stops requiring tests for
  these specific routes.
- **`specs/openapi.yaml` is the contract, generated types are the
  enforcement.** Pre-split, a mismatch between what a page expected and
  what a repository function returned was a TypeScript compiler error,
  instantly, everywhere. Post-split, `web/` and `api/` don't share a
  compiler — so the spec plus `npm run gen:types` in both services plus
  a CI job that fails on drift (`spec-drift` in
  `.github/workflows/ci.yml`) is what replaces that guarantee. It's a
  weaker guarantee (a human has to remember to update the spec) but the
  closest practical substitute across a real service boundary.
- **Creating an order is still one atomic Postgres function call**
  (`create_order_with_items`, called from `api/`) — see ADR 0001
  chapter 3 for why PostgREST needed that instead of a hand-rolled
  transaction. Unchanged by the service split.
- **Admin auth is JWT-based, issued and verified only by `api/`.**
  `web/` stores the token as an opaque string in its own httpOnly
  cookie and forwards it — see ADR 0004 for why this had to change
  (not just move) once `api/` became the actual authorization boundary.
- **Business/legal rules live in `api/src/lib/orders.ts`, not in a
  route handler or a form component.** `web/`'s checkout form does
  light client-side validation for immediate feedback; `validateOrder`
  in `api/` is the actual source of truth — unchanged in substance from
  the pre-split app, just relocated to the service that owns the data
  it's protecting.
- **Money is always integer cents**, never floating-point dollars —
  avoids an entire class of rounding bugs in totals. Enforced by
  convention on both sides now (see `specs/ENGINEERING_RULES.md`
  "Money") rather than by a single shared `cart.ts`.
- **Dates that are calendar dates, not instants** (`requestedDate`) are
  parsed and formatted through `parseDateOnly`/`formatDateOnly`/
  `toDateInputValue`, defined in `web/src/lib/cart.ts` and mirrored
  (the parsing subset) in `api/src/lib/cart.ts` — never
  `new Date(dateOnlyString)` directly. See
  `specs/ENGINEERING_RULES.md` "Date-only values" for the off-by-one-day
  bug this avoids across timezones, and why it's one of the functions
  this repo accepts duplicating rather than sharing a package for.
