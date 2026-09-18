# Testing strategy

## What's tested, and why that layer

The tests in `tests/unit/` target the modules with the highest ratio of
"actual logic" to "framework glue": `src/lib/cart.ts`, `src/lib/orders.ts`,
and `src/lib/auth.ts`. All three are plain TypeScript functions with no
React, no HTTP, and no live database — which is exactly what makes them
worth testing directly rather than only through the UI:

- They're where real bugs hide. A cart total that's off by a cent, a
  validation rule that lets an out-of-state shipping address slip through,
  a session cookie that's still "valid" after it should have expired —
  these are exactly the kind of bug that's easy to introduce in a
  refactor and easy to miss in manual click-testing, because the failure
  is a wrong number or a subtly wrong boolean, not a broken page.
- They're fast and deterministic. No server to boot, no database to seed,
  no network. The full suite runs in under a second.
- They pin down the *contract*, not the implementation. `validateOrder`'s
  tests describe what should and shouldn't be a valid order — the kind of
  spec a second engineer (or a future me) can read to understand the
  business rules without reverse-engineering them from the checkout form.

## What isn't covered here, on purpose

- **API route handlers** (`src/app/api/**/route.ts`) are thin — they parse
  a request, call a repository function, call `validateOrder`, and shape a
  response. The logic worth testing is already covered where it actually
  lives (`orders.ts`, the repositories). An integration test hitting these
  routes over HTTP would mostly be re-testing Next.js's own routing, which
  isn't this project's job to verify. If this app grows more complex
  request handling (rate limiting, multi-step order edits), that's the
  point to add route-level integration tests.
- **The repository layer** (`src/lib/repositories/*.ts`) is exercised
  indirectly by manual end-to-end testing during development (seed → run
  the app → place an order → confirm it shows up correctly) rather than
  automated tests against a real database. Supabase doesn't offer an
  in-memory mode the way `node:sqlite` did in an earlier version of this
  app (see ADR 0001), so the equivalent here is a dedicated test project
  (or the Supabase CLI's local Postgres via `supabase start`) that CI
  resets between runs — worth adding before this schema grows past its
  current three tables.
- **UI components** have no automated tests. For a marketing/ordering site
  this size, the higher-value check is "does it look right and work when
  I click through it," which doesn't need a component-testing framework
  yet. If the checkout form's conditional logic (fulfillment-method
  branching, error display) grows more complex, that's the trigger to add
  React Testing Library.

## Running the suite

```bash
npm test          # run once
npm run test:watch # watch mode
npm run typecheck  # tsc --noEmit — catches a different class of bug than
                    # the test suite: type mismatches the tests wouldn't
                    # exercise if the code path still happens to run
npm run lint       # ESLint, including React-specific rules (e.g. the
                    # rule that caught an unnecessary render-cascade in
                    # CartContext during development — see git history)
```

All four (`lint`, `typecheck`, `test`, `build`) run in CI on every push —
see `.github/workflows/ci.yml`.
