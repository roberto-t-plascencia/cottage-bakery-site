# Testing strategy

The cross-service testing *rule* — what gets tests and at what layer —
now lives in [`specs/ENGINEERING_RULES.md`](../specs/ENGINEERING_RULES.md)
"Testing bar," since it applies identically to both `web/` and `api/`
and needs to stay in one place, not two. This file is the fuller
explanation of *why*, plus what's deliberately left uncovered.

## What's tested, and why that layer

**Pure logic** (`api/src/lib/orders.ts`'s `validateOrder`, the cart math
and date helpers in both services' `cart.ts`) gets unit tests with no
server, no HTTP, and no live database:

- They're where real bugs hide. A cart total that's off by a cent, a
  validation rule that lets an out-of-state shipping address slip
  through, a date that silently shifts by one day across a timezone —
  these are exactly the kind of bug that's easy to introduce in a
  refactor and easy to miss in manual click-testing, because the
  failure is a wrong number or a subtly wrong boolean, not a broken
  page.
- They're fast and deterministic. No server to boot, no database to
  seed, no network. Each service's full unit suite runs in about a
  second.
- They pin down the *contract*, not the implementation.
  `validateOrder`'s tests describe what should and shouldn't be a valid
  order — the kind of spec a second engineer (or a future me) can read
  to understand the business rules without reverse-engineering them
  from the checkout form.

**`api/`'s route handlers get integration tests**
(`api/tests/routes/*.test.ts`, via `supertest` against the real Express
app from `src/app.ts`, with the repository layer mocked). This is new
since [the microservices split](adr/0004-service-boundary.md) — see
`specs/ENGINEERING_RULES.md` "Testing bar" for why the pre-split
reasoning ("route handlers are thin, testing them re-tests the
framework's own routing") stopped applying once `api/` became a real
network boundary with its own auth middleware and its own contract
(`specs/openapi.yaml`) other things depend on. These tests are what
actually verifies status codes, the error envelope shape, and
`requireAdmin` enforcement — the things a unit test of `validateOrder`
alone can't see.

**`web/`'s API routes stay untested at the route level.** They're thin
proxies now (parse the request, forward to `api/`, relay the response)
with no business logic of their own — the pre-split reasoning above
still applies to them specifically, just not to `api/`'s routes anymore.

## What isn't covered, on purpose

- **The repository layer** (`api/src/lib/repositories/*.ts`) is
  exercised indirectly by manual end-to-end testing during development
  (seed → run both services → place an order → confirm it shows up
  correctly) rather than automated tests against a real database.
  Supabase doesn't offer an in-memory mode the way `node:sqlite` did in
  an earlier version of this app (see ADR 0001), so the equivalent here
  is a dedicated test project (or the Supabase CLI's local Postgres via
  `supabase start`) that CI resets between runs — worth adding before
  this schema grows past its current three tables. The route tests
  above mock this layer specifically so they don't need that
  infrastructure to exist yet.
- **UI components** have no automated tests. For a marketing/ordering
  site this size, the higher-value check is "does it look right and
  work when I click through it," which doesn't need a
  component-testing framework yet. If the checkout form's conditional
  logic (fulfillment-method branching, error display) grows more
  complex, that's the trigger to add React Testing Library.
- **No end-to-end test drives both services together through a real
  browser.** Manual click-through (`docker compose up`, then use the
  app) covers this today. Worth adding (Playwright, most likely) if
  the checkout flow grows enough steps that manual verification before
  each release stops being reliable.

## Running the suite

Each service is tested independently — there's no single command that
runs both, matching the fact that they're independently deployable (see
ADR 0004).

```bash
cd web   # or api
npm test          # run once
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit — catches a different class of bug than
                    # the test suite: type mismatches the tests wouldn't
                    # exercise if the code path still happens to run
npm run lint       # ESLint
```

Both services' `lint`, `typecheck`, `test`, and `build` run in CI on
every push, path-filtered so a change to only one service doesn't
trigger the other's job — see `.github/workflows/ci.yml`. A separate
`spec-drift` job regenerates both services' OpenAPI-derived types and
fails if that produces a diff from what's committed.
