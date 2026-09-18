# Engineering rules

Conventions both `web/` and `api/` follow, written down because the
services no longer share a TypeScript import graph to enforce them
silently. Before the split (see
[ADR 0004](../docs/adr/0004-service-boundary.md)), a rule like "money is
always integer cents" was enforced by the fact that there was only one
`cart.ts` — every caller of `formatCents` or `cartSubtotalCents` got it
for free. Post-split, `web/` and `api/` are separate processes with
separate `node_modules`, and nothing stops a future PR to one service
from quietly reintroducing a bug the other service already avoided. This
file is where that shared understanding now lives, in prose instead of
in the type system.

This is scoped to *this app's* rules — for how to set up a dev
environment, branch, and open a PR, see
[`../CONTRIBUTING.md`](../CONTRIBUTING.md).

## The API contract

[`openapi.yaml`](./openapi.yaml) in this directory is the single source
of truth for the web↔api HTTP contract — request/response shapes, status
codes, the one error envelope (below). Both services generate
TypeScript types from it:

```bash
npm run gen:types   # writes src/lib/api-schema.generated.ts
```

**Never hand-edit a `*.generated.ts` file.** If a response shape needs
to change, change `openapi.yaml` first, then regenerate in both
services. CI regenerates and diffs on every push
(`.github/workflows/ci.yml`, job `spec-drift`) specifically to catch the
case where someone changed a route's actual response shape without
touching the spec — that PR should fail, not merge with a contract that
quietly stopped being true.

This is a **hand-written spec describing hand-written routes**, not the
other way around — `api/`'s route handlers aren't generated from
`openapi.yaml`; a human keeps them in sync, the same way `src/lib/types.ts`
is a human-maintained mirror of `supabase/migrations/0001_init.sql` (see
[ADR 0001](../docs/adr/0001-tech-stack.md)). Route-level tests
(`api/tests/routes/`) are what actually catches drift between "what the
spec says" and "what the route returns," not the spec itself — the spec
generates types, not guarantees.

## Error envelope

Every non-2xx response from `api/` is:

```json
{ "errors": ["human-readable message", "..."] }
```

Always the plural key, always an array — even for a single error. The
pre-split codebase was inconsistent here (`{ "error": "..." }` in some
routes, `{ "errors": [...] }` in others — compare the old
`api/admin/login/route.ts` and `api/admin/orders/[id]/route.ts` in git
history before this split). That inconsistency is exactly the kind of
thing this document exists to prevent from happening again: pick one
shape, write it down, and `web/`'s proxy routes and error-display code
only ever need to handle one case.

## Auth header

Admin requests from `web/` to `api/` carry `Authorization: Bearer
<token>`, where `<token>` is the JWT `POST /admin/login` returned.
`web/` treats this token as opaque — it stores it in its own httpOnly
cookie and forwards it verbatim; it never inspects or verifies the JWT's
signature, because only `api/` holds the secret that signs it (see ADR
0004). Any new admin-only route in `api/` goes behind the
`requireAdmin` middleware (`api/src/middleware/requireAdmin.ts`), not a
hand-rolled check in the route itself.

## Money

Always integer cents, never floating-point dollars. `priceCents`,
`unitPriceCents`, `subtotalCents` — every money field, on both sides of
the boundary, in the database, and on the wire. Converting to a
display string happens in exactly one place per service
(`formatCents` in `web/src/lib/cart.ts`) and only at render time, never
before.

## Date-only values

`requestedDate` is a calendar date, not an instant — it's a Postgres
`date` column, not `timestamptz`. It moves through the system as a bare
`"YYYY-MM-DD"` string. **Never** call `new Date(dateOnlyString)` or
`.toISOString().slice(0, 10)` on one of these — both silently convert
through UTC, which can shift the displayed or validated date by one day
depending on the server or browser's timezone (this was a real,
previously-latent bug — see the "Timezone/off-by-one-day bug" account in
`web/docs/adr/0001-tech-stack.md`'s history, and the regression tests in
both services' `cart.test.ts`). Use `parseDateOnly` /
`formatDateOnly` / `toDateInputValue` — defined in `web/src/lib/cart.ts`
and mirrored (the date-only subset only) in `api/src/lib/cart.ts` — for
every read or write of this field, on both sides.

## Duplicated code, on purpose

`api/src/lib/cart.ts` and `api/src/lib/config.ts` are deliberate,
hand-kept-in-sync duplicates of the corresponding files in `web/`. This
project has no shared `packages/` workspace between the two services —
see [ADR 0004](../docs/adr/0004-service-boundary.md) for why that was a
deliberate omission (a shared runtime package between two
"independently deployable" services quietly reintroduces the coupling
the split exists to remove: a version bump to the shared package now
means coordinating two deploys again).

The rule this project follows: a handful of small, stable, pure
functions (date parsing, cart math, static business config) are cheap
enough to duplicate by hand, and the cost of doing so is bounded — a
`grep` across both `src/lib/cart.ts` files during review is enough to
catch drift, and the regression tests exist independently in both
services. If this list grows past "a handful," or if the two copies
start drifting in practice (not just in theory), that's the trigger to
revisit — either promote to a real shared package (accepting the
coordinated-deploy cost) or generate one side from the other. Not
"never share code across services" as a rule — "don't share code across
services *until sharing it is cheaper than duplicating it*."

## Testing bar

- **Pure logic** (`validateOrder`, cart math, date helpers) gets unit
  tests in both services, with no server or database involved — same
  reasoning as pre-split (see `web/docs/TESTING_STRATEGY.md`).
- **`api/` route handlers get integration tests** (`api/tests/routes/`,
  via `supertest` against `createApp()`) — this is new since the split.
  Pre-split, `web/docs/TESTING_STRATEGY.md` argued route handlers were
  "thin" and testing them would mostly re-test Next.js's own routing.
  That argument stopped holding once `api/` became a real network
  boundary with its own auth middleware, its own status codes, and its
  own contract other things (eventually) depend on — a route test here
  is what actually verifies the contract in `openapi.yaml` is true, not
  just documented.
- **`web/`'s API routes stay untested at the route level** — they're now
  thin proxies (parse the request, forward it to `api/`, relay the
  response) with no business logic of their own, so the pre-split
  reasoning still applies to them specifically.
- The repository layer (`api/src/lib/repositories/`) is still exercised
  manually rather than against a real database — unchanged from
  pre-split; see `web/docs/TESTING_STRATEGY.md`'s note on what a
  Supabase-CLI-backed test database would take to add.

## Commit style

Imperative mood, one logical change per commit (`Fix off-by-one-day bug
in date-only parsing`, not `fixes` or `misc updates`). A commit that
touches both services' generated types belongs with the `openapi.yaml`
change that caused them, not split across two commits — the spec and
its generated output should never be independently reviewable, since
one is meaningless without the other.
