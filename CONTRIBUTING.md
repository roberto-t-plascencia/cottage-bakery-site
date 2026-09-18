# Contributing

This is currently a one-person project, but it's set up the way a small
team's repo should be — partly because that's just good practice, and
partly because "how would I brief a new engineer joining this repo" is a
useful test of whether the setup actually makes sense. If that ever
becomes literally true, this document is where they'd start.

## Local setup

See the "Getting started" section of `README.md`. If `npm install` or
`npm run db:seed` doesn't work exactly as documented there, that's a bug
in the documentation — please fix it in the same PR rather than working
around it silently, so the next person doesn't hit the same wall.

## Before opening a PR

Run the same checks CI runs, locally, before pushing:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

All four need to pass. CI re-runs them anyway, but catching a failure
locally is faster than catching it in a CI log.

## Code organization ground rules

These aren't arbitrary — each one exists to prevent a specific kind of
mess from creeping in as the app grows. See `docs/ARCHITECTURE.md` for
the full picture.

- **SQL lives only in `src/lib/repositories/`.** A page or API route
  should never call `db.prepare(...)` directly — go through (or add to)
  a repository function. This is what keeps a future schema change or
  database swap to one place instead of a grep-and-pray across the app.
- **Business/legal rules live in `src/lib/orders.ts` (or a similar pure
  module), not inline in a route handler or a form component.** If you're
  writing an `if` statement that encodes a business rule ("shipping
  requires a CA address", "orders need N days lead time"), ask whether it
  belongs in a testable pure function instead of buried in a component.
- **Money is integer cents, always.** Never introduce a float dollar
  amount — that's how `$19.999999999998` bugs happen.
- **A non-trivial decision gets an ADR**, not just a code comment. If
  you're choosing between two real alternatives and it's not obvious why,
  future-you (or the next person) will want to know what the alternatives
  were and why they lost. Copy the format in `docs/adr/0001-*.md` — status,
  context, decision, and the honest costs of the choice, not just its
  benefits.

## Commit messages

Plain, present-tense, and explain *why* when the *what* isn't
self-evident from the diff. `git log` is a good enough style reference —
this repo doesn't use a strict Conventional Commits format, just clear
English.

## Pull requests

Use the PR template (`.github/pull_request_template.md`). A PR that
touches business logic (`src/lib/`) should come with test changes in the
same PR, not a follow-up promise — see `docs/TESTING_STRATEGY.md` for
what's expected to be covered.
