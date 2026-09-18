# ADR 0003: Admin auth — one shared password, not a user system

**Status:** Accepted
**Date:** 2026-09-18

## Context

The admin dashboard (`/admin`) needs to be restricted to the bakery
operator. There is exactly one operator today.

## Decision

A single password, set via the `ADMIN_PASSWORD` environment variable, with
no username. A successful login gets a signed, `httpOnly` session cookie
(HMAC-SHA256 over an expiry timestamp, `src/lib/auth.ts`) valid for 12
hours. `src/proxy.ts` redirects any unauthenticated request under
`/admin/*` to `/admin/login`; the admin API routes re-check the session
themselves rather than trusting that the proxy already filtered the
request (see the comment in `src/app/api/admin/orders/[id]/route.ts` —
proxy-layer checks are explicitly documented by Next.js as an optimistic
check, not a full authorization solution).

Password comparison uses `timingSafeEqual` rather than `===`, specifically
so a wrong guess can't be distinguished from a right one by response
timing — a small thing, but it's the kind of small thing that separates
"looks secure" from "is secure," and costs nothing to get right.

## Why not a real user/auth system

There is no second user to authenticate. A users table, password hashing
(bcrypt/argon2), session-per-user tracking, and a password-reset flow are
all real engineering work that would sit unused — built for a scale of
problem (multiple admins with different permissions, self-service password
recovery) this business doesn't have.

## What would make this the wrong call

- **A second person needs access** (a helper baker, a partner doing
  weekend pickups). At that point this needs actual per-user accounts —
  sharing one password among multiple people means no audit trail (who
  marked this order cancelled?) and no way to revoke one person's access
  without changing the password for everyone.
- **The password needs to be recoverable without redeploying.** Right now,
  changing it means changing an environment variable and redeploying.
  Fine for one operator who controls the deploy; not fine the moment
  someone without deploy access needs to be able to rotate it themselves.
- **Compliance requirements show up** (unlikely for a home bakery, but:
  anything requiring audit logs of who-did-what would need real user
  identity, not a shared secret).

Any of those is a sign to replace this with a minimal real auth system
(even something as simple as a single `admins` table with hashed
passwords) rather than patching around the shared-password model further.
