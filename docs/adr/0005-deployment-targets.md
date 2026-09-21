# ADR 0005: Deployment targets — both services on Vercel

**Status:** Accepted
**Date:** 2026-09-20 (updated 2026-09-20: api/ moved from "TBD" to "Vercel")

## Context

[ADR 0004](0004-service-boundary.md) split the app into two
independently-deployable services. "Independently deployable" was a
claim about the architecture, not a hosting plan — until now, neither
service had an actual place to run in production. `.github/workflows/ci.yml`
had a `deploy-placeholder` job that builds both services' Docker images
on push to `main` specifically to be honest about that gap: it proves
the images still build, and says outright that nothing gets pushed or
deployed anywhere.

This ADR originally shipped with `web/` decided and `api/` left open. The
reasoning at the time for leaving `api/` off Vercel was a generic one:
Express apps are built around a long-lived `app.listen()` process, and
Vercel's execution model is stateless functions with cold starts, so the
two seemed like a mismatch. Revisiting that assumption against what
`api/` actually does (rather than what Express apps do in general) is
what changed the decision below.

## Decision

Both `web/` and `api/` deploy to **Vercel**, connected directly to this
GitHub repo (`roberto-t-plascencia/cottage-bakery-site`, team `bakery7`):

**`web/`** — project `cottage-bakery-web`:

- **Root Directory**: `web` — required once this became a monorepo with
  no root `package.json`; without it Vercel tries to build from the repo
  root and fails.
- **Production Branch**: `main` — matches
  [`CONTRIBUTING.md`](../../CONTRIBUTING.md)'s branching strategy exactly.
  Vercel's own default "Preview = all other branches" already covers
  `develop` and any feature branch, so every push to `develop` gets a
  Preview deployment with a shareable URL, and merging `develop` → `main`
  is what promotes to production. No GitHub Actions wiring was needed for
  this — Vercel's GitHub App watches the repo directly, independent of
  `ci.yml`.

**`api/`** — project `cottage-bakery-api`:

- **Root Directory**: `api`, **Production Branch**: `main` — same
  reasoning as `web/`.
- Served as a Vercel serverless function via `api/api/index.ts`, which
  wraps the same `createApp()` that `api/src/index.ts` uses for local
  dev and Docker Compose — `api/vercel.json` rewrites every incoming
  path to that one function so Express's own router decides what
  handles a request, not Vercel's filesystem routing. The app itself
  stays host-agnostic; only the entrypoint differs per host (see
  [ADR 0004](0004-service-boundary.md)).

## Why api/ turned out to fit Vercel's model after all

The original "long-lived process vs. stateless function" concern is
real in general, but doesn't describe what `api/` actually does:

- `api/src/lib/supabase.ts` talks to Supabase over HTTPS via
  `supabase-js` (PostgREST), not a raw Postgres connection pool — so
  there's no connection-exhaustion risk from many short-lived
  invocations opening and dropping connections, which is the usual way
  "serverless + Postgres" goes wrong.
- `api/src/lib/auth.ts` issues a signed JWT with no server-side session
  store — admin auth is already fully stateless.
- Image uploads (`api/src/lib/storage.ts`) go to Supabase Storage, not
  local disk — nothing written to a function instance's ephemeral
  filesystem needs to survive between requests.
- No cron jobs, no `setInterval`, no in-memory caches or rate limiters
  anywhere in `api/src`.

In short: `api/` was already stateless before this decision, it just
hadn't been deployed as a stateless function yet. A second Vercel
project (`cottage-bakery-api`) had been created early on while exploring
this and left unconnected — this ADR is what connects it.

## Cost

Vercel's Hobby tier is for personal, non-commercial projects. Mission
Valley Home Bakers is a real registered Cottage Food Operation, not a
demo, so running it on Hobby once it's actually taking orders would be
against Vercel's terms. The plan: stay on Hobby while the site isn't yet
taking real orders, and move the `bakery7` team to Pro ($20/mo) within
the next few days, before launch. This is called out explicitly rather
than left implicit, in keeping with this project's practice of writing
down real cost tradeoffs instead of only technical ones.

## What this replaces

- The `deploy-placeholder` job in `.github/workflows/ci.yml` no longer
  describes `api/`'s image build as heading nowhere — see its own
  updated comments. Both services' Docker builds in that job are now
  build-verification checks (useful for `docker-compose` / as an escape
  hatch if either service ever needs a non-Vercel host later), not the
  deploy path — Vercel's GitHub App is.
- `web/`'s `API_URL` environment variable is set in Vercel's Environment
  Variables (Production and Preview) to the deployed `api/` project's
  URL, replacing the `docker-compose.yml`-only value it had before.
