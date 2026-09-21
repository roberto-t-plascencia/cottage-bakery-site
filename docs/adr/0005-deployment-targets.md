# ADR 0005: Deployment targets — web/ on Vercel, api/ still TBD

**Status:** Partially accepted (`web/` decided and wired up; `api/`
deliberately left open)
**Date:** 2026-09-20

## Context

[ADR 0004](0004-service-boundary.md) split the app into two
independently-deployable services. "Independently deployable" was a
claim about the architecture, not a hosting plan — until now, neither
service had an actual place to run in production. `.github/workflows/ci.yml`
had a `deploy-placeholder` job that builds both services' Docker images
on push to `main` specifically to be honest about that gap: it proves
the images still build, and says outright that nothing gets pushed or
deployed anywhere.

## Decision

`web/` deploys to **Vercel**, connected directly to this GitHub repo
(`roberto-t-plascencia/cottage-bakery-site`, team `bakery7`,
project `cottage-bakery-web`):

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

`api/` is **not** on Vercel, and does not have a host yet. Reasoning:

- `api/` is a long-lived Express process — it holds no state itself
  (Supabase is the persistence layer), but Vercel's execution model is
  serverless functions with cold starts, per-invocation, not a
  continuously-running server. Getting `api/` onto Vercel would mean
  adapting it to that model, not just deploying it as-is.
- A second Vercel project (`cottage-bakery-api`) was created early on
  while exploring this, but was deliberately left unconnected — keeping
  `api/` on a platform built for long-lived Node processes (Railway,
  Render, Fly.io, a VPS) is the more honest fit for what it actually is,
  rather than forcing one platform for both services because it's
  convenient.

## Why not decide api/'s host in this same ADR

Because it isn't decided yet, and writing down a made-up answer here
would be worse than an open gap that's clearly labeled. The real inputs
— expected traffic, budget, whether Supabase's own connection pooling
plays nicely with the host's networking, whether there's ever a second
environment (staging) worth paying for — aren't things this project has
had to answer yet at zero orders.

## What changes when api/'s host is picked

- This ADR gets a "Status: Accepted" update and a short "why this host"
  section, in the same spirit as the reasoning above.
- The `deploy-placeholder` job in `.github/workflows/ci.yml` stops being
  a placeholder for `api/`'s image: `push: false` becomes a real push to
  a registry, plus whatever the host needs to pick it up (a deploy hook,
  a `flyctl deploy`, a Railway/Render webhook, etc.).
- `web/`'s `API_URL` environment variable (currently only meaningful
  locally / in `docker-compose.yml`) gets set in Vercel's Environment
  Variables for Production and Preview, pointing at the real `api/`
  deployment(s) — until then, a deployed `web/` can serve pages but any
  request that reaches `api/` (products, orders, admin) has nowhere to
  go.
