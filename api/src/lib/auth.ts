import { timingSafeEqual } from "crypto";
import jwt from "jsonwebtoken";
import { getEnv } from "./env";

/**
 * Admin auth, JWT edition. Still a single shared ADMIN_PASSWORD — no user
 * table, no OAuth (that scope call is unchanged from ADR 0003, and is
 * this service's problem now, not web/'s). What changed with the
 * microservices split is *how the session is represented*: a
 * self-contained, stateless JWT this service signs and verifies, instead
 * of a session cookie whose HMAC only web/ used to know how to check.
 *
 * Why the change was forced, not chosen for its own sake: once `web/`
 * stopped being the thing that talks to the database, it also stopped
 * being the natural place to decide "is this admin request allowed to
 * change an order's status" — that's this service's call, since this
 * service is what a hand-crafted curl request to /admin/orders/:id would
 * actually reach. A stateless JWT means `web/` can hold the token as an
 * opaque string in its own httpOnly cookie and forward it as
 * `Authorization: Bearer <token>` on every admin request, without web/
 * ever needing this service's signing secret — only this service ever
 * calls `verifyAdminToken`. See docs/adr/0004-service-boundary.md for the
 * full account of what this cost (a second env var, no token revocation
 * — see the comment on ADMIN_TOKEN_TTL_SECONDS below).
 */

const ADMIN_TOKEN_TTL_SECONDS = 60 * 60 * 12; // 12 hours — same lifetime as the old cookie

export function checkAdminPassword(candidate: string): boolean {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) {
    throw new Error("ADMIN_PASSWORD is not set. Refusing to authenticate.");
  }
  const a = Buffer.from(candidate);
  const b = Buffer.from(expected);
  // Constant-time comparison so response timing can't leak how many
  // leading characters of the password guess were correct.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function issueAdminToken(): string {
  return jwt.sign({ role: "admin" }, getEnv("JWT_SECRET"), {
    expiresIn: ADMIN_TOKEN_TTL_SECONDS,
  });
}

/**
 * Returns true for a token this service signed, that hasn't expired, and
 * whose payload actually claims the admin role — not just "any valid
 * JWT" (defensive against a future second token type signed with the
 * same secret for something else).
 *
 * No revocation list: a token stays valid until it expires, even if the
 * admin "logs out" (web/'s logout route just deletes its cookie — see
 * web/src/app/api/admin/logout/route.ts). For a single-operator bakery
 * dashboard on a 12-hour token, that's an accepted gap, not an oversight
 * — see docs/adr/0004-service-boundary.md for what would make it wrong
 * (a lost/shared device, a second admin, anything the old world's
 * "delete the row" logout could do that this can't).
 */
export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  try {
    const payload = jwt.verify(token, getEnv("JWT_SECRET"));
    return typeof payload === "object" && payload !== null && payload.role === "admin";
  } catch {
    return false; // expired, malformed, or signed with a different secret
  }
}
