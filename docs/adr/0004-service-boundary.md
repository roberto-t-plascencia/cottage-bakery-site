# ADR 0004: Service boundary — web/ and api/ as separate deployables, in one repo

**Status:** Accepted
**Date:** 2026-09-18

## Context

Up to this point, the whole app was a single Next.js deployable: pages,
API routes, and the code that talked to Supabase all lived in one
process, one `package.json`, one deploy. That's a completely reasonable
architecture for what this app actually is — a marketing site and order
form for one home bakery, with a request volume that will never stress a
single small container.

This ADR exists because of a direct disagreement with that shape, not a
discovered problem with it: *"I have always thought that a microservices
architecture provides a better separation of concern than a
monolith."* That's a real, defensible position in general — and it's
worth being precise about what it's actually a position on, because two
different axes get conflated under "monolith vs. microservices" more
often than they should:

1. **Deployment topology** — is this one process you deploy, or several
   independent ones that scale, fail, and release separately? This is
   the *monolith vs. microservices* axis.
2. **Source-control topology** — is the code for those deployables in
   one repo, or several? This is the *monorepo vs. polyrepo* axis.

These are orthogonal. You can have a polyrepo monolith (one deployable,
its code oddly split across repos — usually an accident, not a design).
You can have a monorepo of microservices (many independently-deployable
services, one repo holding all of them — Google and Meta both run this
way, and it's the shape chosen here: `web/` and `api/` are two separate
deployables, each with its own `package.json`, `Dockerfile`, and CI job,
sharing one git history). The disagreement that started this ADR was
really about axis 1. Axis 2 was never really in question — nothing about
wanting real service boundaries requires scattering their source across
separate repos, and for two services this small, a polyrepo would only
add friction (two clone steps, two PRs for one cross-cutting change,
no single commit that shows "the spec and both sides of it changed
together" the way this repo's own history now can).

## Decision

Split the single Next.js app into two independently-deployable services,
in the same repo:

- **`web/`** — Next.js. Owns the UI, the client-side cart, and the admin
  session cookie. Never talks to Supabase. The Backend-for-Frontend
  (BFF): the browser only ever talks to `web/`; `web/`'s own API routes
  and Server Components call `api/` over HTTP, server-side.
- **`api/`** — Express + TypeScript. Owns Supabase (Postgres + Storage),
  order/business validation, and admin auth (now JWT-based — see below).
  The *only* thing that holds the `service_role` key.

The contract between them is [`specs/openapi.yaml`](../../specs/openapi.yaml),
with generated TypeScript types on both sides
(`specs/ENGINEERING_RULES.md` covers the rules this enables and requires).

## Why the split is over-engineering for this app, honestly

Said plainly, because the code and docs should be honest about this
rather than quietly defending the more "impressive"-looking architecture:
a home bakery placing a few dozen orders a week does not need two
services. A single Next.js deployable handles this app's real load with
enormous headroom, deploys in one step, and has no network hop between
"render the menu" and "read the menu from the database." Everything this
split costs (below) is a real cost paid for a benefit — practice with a
genuine service boundary — that has nothing to do with this app's actual
operating requirements. If a friend running a similar cottage bakery
asked for advice on their own site, the honest answer would be: don't do
this, ship the monolith, it's the correct engineering call for the
problem. This repo does it anyway because the point of this project was
never *only* to run a bakery's ordering — see the README's framing —
and "what does a real service boundary cost, and where does it actually
pay for itself" isn't something an ADR can teach as convincingly as
paying the cost once and writing down what happened.

## What this actually cost

- **Admin auth had to be redesigned, not just moved.** The old
  single-process app used a self-contained signed session cookie —
  `web/` both issued and verified it, because it was the only process
  that ever needed to. Once `api/` became the thing that actually
  authorizes "change this order's status," `web/` verifying its own
  session cookie stopped being sufficient: a compromised or buggy
  `web/` deploy could no longer be trusted to be the sole gate in front
  of `api/`. The fix — `api/` issues a JWT, `web/` stores it as an
  opaque token and forwards it as `Authorization: Bearer`, without ever
  holding the signing secret — is more correct for a real multi-service
  system, but it's strictly more moving parts than the single-process
  version needed. See `api/src/lib/auth.ts` and
  `specs/ENGINEERING_RULES.md` "Auth header."
- **No token revocation.** The old cookie was self-contained too (no
  server-side session table), so this isn't a regression — but it's
  worth naming: "logout" is `web/` deleting its own cookie, not
  invalidating anything on `api/`. A leaked token is valid until it
  expires (12 hours). Fine for a single-operator dashboard; a real
  reason this would need to change is in ADR 0003's "what would make
  this wrong" section, which still applies.
- **No shared runtime package, so a few small files are duplicated by
  hand** (`api/src/lib/cart.ts`'s date-only subset, `api/src/lib/
  config.ts`). A monolith gets this for free — one `cart.ts`, every
  caller imports it. Two independently-deployable services sharing an
  npm package would reintroduce real coupling (a bump to the shared
  package now means coordinating two release trains), which defeats
  the point of the split — so this repo accepts hand-duplication of a
  small, stable surface instead, and writes down the rule for when
  that stops being the right call. See
  `specs/ENGINEERING_RULES.md` "Duplicated code, on purpose."
- **The API contract needed to become explicit.** Pre-split,
  `src/lib/repositories/*.ts`'s function signatures *were* the
  contract — a TypeScript compiler error caught a mismatch immediately,
  across the whole app, for free. Post-split, `web/` and `api/` don't
  share a compiler; nothing stops one side's route from changing shape
  without the other side noticing until it breaks at runtime. That's
  what `specs/openapi.yaml` plus generated types on both sides is
  for — but writing and maintaining a spec, plus a CI job
  (`spec-drift`) to catch when it's gone stale, is real ongoing work a
  monolith never needed.
- **Every menu and admin-order-list read is now a network hop.**
  `/menu` and `/admin` used to call the repository layer in-process;
  now they call `api/` over HTTP. Latency, an extra failure mode
  (`api/` down = every page that reads data breaks, not just the ones
  using a feature that happens to be broken), and a second thing to
  keep running in production.
- **Two deploys, two sets of environment variables, two Dockerfiles,
  two CI jobs.** `docker-compose.yml` orchestrating two services is
  more than twice the operational surface of one — there's now a
  dependency order (`api` before `web`), a second port, a second set
  of secrets, a second thing that can be misconfigured.
- **Route-level tests became worth writing.** Not purely a cost — this
  is a case where the split genuinely improved the testing story — but
  it's still new work `api/tests/routes/` didn't exist before there
  was a real network boundary to test against (see
  `specs/ENGINEERING_RULES.md` "Testing bar" for the reasoning that
  changed).

## Alternatives considered

- **Keep the monolith, write an ADR defending it.** The lower-risk,
  arguably more professionally honest choice for a real solo bakery —
  and the position this ADR itself argues for, above, if this were a
  real client's app. Rejected for *this* project specifically because
  the value being optimized for here is deliberate practice with a
  service boundary, not this app's actual operational needs.
- **A shared `packages/` workspace (npm/pnpm workspaces) for the
  duplicated types and utilities.** Would remove the hand-duplication
  cost above, at the price of reintroducing a shared dependency between
  two "independently deployable" services — a version bump to the
  shared package means both services need to pick it up before either
  can be considered current, which is exactly the coordinated-release
  coupling a service split is usually meant to remove. Rejected for
  now; revisit if the duplicated surface grows past what
  `specs/ENGINEERING_RULES.md` calls "a handful."
  - Note this is different from the OpenAPI-generated types
    (`*-schema.generated.ts`) in each service — those aren't shared
    *code*, they're independently generated from a shared *spec*, which
    is the whole point: each service can regenerate and re-vendor its
    own copy without the other needing to release in lockstep.
- **GraphQL instead of a REST-ish JSON API + OpenAPI.** Would give
  codegen and a single schema too, but is a heavier tool than four
  simple resources (products, orders, order status, admin login)
  justify, and OpenAPI's ecosystem for "generate types from a spec"
  is simpler to reach for at this scale.

## What would make this the right call for real

Not "we did it for practice" reasons — genuine operational reasons a
real bakery-ordering system might eventually have:

- **`api/` needs to be reused by something other than `web/`** — a
  future mobile app, a partner integration, a second frontend. This is
  the single strongest real reason: the moment there's a second
  legitimate client of the order/product data, a BFF-only API stops
  making sense and a real API becomes the right shape regardless of
  scale.
- **`web/` and `api/` need to scale, deploy, or fail independently at
  a load that actually stresses one but not the other** — e.g. a
  traffic spike hitting `/menu` shouldn't risk order-processing
  capacity, or vice versa. Not remotely close to this app's real load.
- **Different teams own different parts.** A team boundary is one of
  the more durable reasons for a service boundary — it turns "please
  don't break my code" into "here's the contract, don't break that."
  Doesn't apply to a one-person project.
- **A real compliance or security requirement** demands the database
  credentials live in a narrower blast radius than "anything the
  frontend process can reach" — same reasoning as ADR 0003's "what
  would make it wrong," extended: a payment-processing add-on, for
  instance, would be a legitimate reason to isolate secrets this way
  for real, not for practice.

None of those apply to this app today. They're the honest answer to
"when would I actually need this," which is the question this ADR's
existence is trying to make it easier for whoever reads this repo next
— including a future me, in an interview — to answer correctly instead
of reflexively.
