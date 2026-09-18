/**
 * What's left of admin "auth" in web/ after the microservices split: a
 * cookie name and nothing else. The actual password check and JWT
 * signing/verification now live in api/src/lib/auth.ts — this service
 * never sees the admin password and never holds the JWT secret.
 *
 * web/ treats the session cookie's value as an opaque token: it stores
 * whatever api/'s POST /admin/login returned, forwards it verbatim as
 * `Authorization: Bearer <token>` on admin API calls, and never inspects
 * or verifies it. That's not a corner cut for convenience — it's the
 * point of the split: verifying the token would require web/ to hold
 * api/'s signing secret, which would mean a compromised web/ deploy
 * could mint its own admin tokens. See
 * docs/adr/0004-service-boundary.md.
 */
export const ADMIN_SESSION_COOKIE_NAME = "bakery_admin_token";

// Matches api/'s ADMIN_TOKEN_TTL_SECONDS (api/src/lib/auth.ts) — this is
// the cookie's max-age, not a second source of truth for when the JWT
// itself expires. If they drift, the JWT expiring first is harmless (api/
// just starts rejecting it); the cookie outliving the JWT is harmless too
// (api/ still rejects the expired token) — so this doesn't need to be
// exact, just roughly right so the cookie doesn't outlive the browser
// session by some absurd margin.
export const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12; // 12 hours
