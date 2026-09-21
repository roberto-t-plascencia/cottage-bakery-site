# Contributing

This is currently a one-person project, but it's set up the way a small
team's repo should be — partly because that's just good practice, and
partly because "how would I brief a new engineer joining this repo" is a
useful test of whether the setup actually makes sense. If that ever
becomes literally true, this document is where they'd start.

## Repo layout

Two independently-deployable services, one repo — see
[`CLAUDE.md`](CLAUDE.md) for the map and
[ADR 0004](docs/adr/0004-service-boundary.md) for why. In short:
`web/` is the Next.js frontend, `api/` is the Express backend that owns
Supabase, and [`specs/`](specs/) is the contract between them. Most
changes touch exactly one service; changes to a request/response shape
touch `specs/openapi.yaml` plus both services' generated types.

## Local setup

See the "Getting started" section of `README.md`. If `npm install` in
either service, or `docker compose up`, doesn't work exactly as
documented there, that's a bug in the documentation — please fix it in
the same PR rather than working around it silently, so the next person
doesn't hit the same wall.

## Before opening a PR

In **each service you touched**, run the same checks CI runs, locally,
before pushing:

```bash
cd web   # or api
npm run lint
npm run typecheck
npm test
npm run build
```

If you touched `specs/openapi.yaml`, regenerate types in **both**
services and commit the result:

```bash
cd api && npm run gen:types
cd ../web && npm run gen:types
```

CI re-runs all of this anyway (path-filtered per service, plus a
`spec-drift` job that fails if a generated-types file doesn't match what
regenerating it produces) — but catching a failure locally is faster
than catching it in a CI log.

## Code organization ground rules

These aren't arbitrary — each one exists to prevent a specific kind of
mess from creeping in as the app grows, and several of them exist
*specifically because* the split into two services removed the compiler's
ability to enforce them for free. See `docs/ARCHITECTURE.md` for the full
picture and [`specs/ENGINEERING_RULES.md`](specs/ENGINEERING_RULES.md)
for the complete, current list — summarized here:

- **Supabase access lives only in `api/src/lib/repositories/`.** Nothing
  in `web/` talks to Supabase — it can't; the client and credentials
  live in `api/` only. A route or Server Component in `web/` that needs
  data calls `api/src/lib/apiClient.ts`, never a repository function
  directly.
- **Business/legal rules live in `api/src/lib/orders.ts` (or a similar
  pure module), not inline in a route handler or a form component.** If
  you're writing an `if` statement that encodes a business rule
  ("shipping requires a CA address", "orders need N days lead time"),
  ask whether it belongs in a testable pure function instead of buried
  in a component — and whether it belongs in `api/` (enforced) rather
  than only `web/` (UX only).
- **Money is integer cents, always.** Never introduce a float dollar
  amount — that's how `$19.999999999998` bugs happen.
- **`specs/openapi.yaml` changes before the code that implements it
  does**, where practical — see `specs/ENGINEERING_RULES.md` "The API
  contract."
- **A non-trivial decision gets an ADR**, not just a code comment. If
  you're choosing between two real alternatives and it's not obvious why,
  future-you (or the next person) will want to know what the alternatives
  were and why they lost. Copy the format in `docs/adr/0001-*.md` — status,
  context, decision, and the honest costs of the choice, not just its
  benefits.

## Branching strategy

Two long-lived branches, git-flow-lite:

- **`develop`** is the integration branch. All day-to-day work — feature
  branches, fixes, chores — targets `develop` via PR. This is what CI
  runs against on every push (see `.github/workflows/ci.yml`), so
  `develop` should stay green; it's where things get exercised together
  before anyone calls them done.
- **`main`** is production. It only moves when `develop` merges into it.
  That merge *is* the release. For `web/`, it's a real one: `web/` is
  connected to Vercel (Root Directory `web`, Production Branch `main`),
  so merging to `main` triggers an actual production deployment there,
  and every push to `develop` gets its own Preview deployment with a
  shareable URL — see [ADR 0005](docs/adr/0005-deployment-targets.md).
  `api/` doesn't have a host yet, so for `api/` a push to `main` still
  only runs the `deploy-placeholder` CI job, which builds its Docker
  image to prove it still builds without pretending it's deployed
  anywhere. Wiring up a real `api/` deploy means picking a host (Fly.io,
  Railway, a VPS, etc.), pushing images to a registry, adding that
  host's credentials as repo secrets, and replacing the placeholder
  build step with a real push + deploy step.

Practically: branch feature work off `develop`, open the PR against
`develop`, and treat "merge `develop` → `main`" as its own deliberate
release action (its own PR, or a fast-forward once `develop` is in a
known-good state) rather than something that happens as a side effect of
finishing a feature.

## Commit messages

Plain, present-tense, and explain *why* when the *what* isn't
self-evident from the diff. `git log` is a good enough style reference —
this repo doesn't use a strict Conventional Commits format, just clear
English. See `specs/ENGINEERING_RULES.md` "Commit style" for the one
rule specific to this repo's two-service shape (spec + generated-type
changes travel together).

## Pull requests

Use the PR template (`.github/pull_request_template.md`). A PR that
touches business logic (`api/src/lib/`) should come with test changes in
the same PR, not a follow-up promise — see
`specs/ENGINEERING_RULES.md` "Testing bar" for what's expected to be
covered.
