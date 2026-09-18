import { createHmac, timingSafeEqual } from "crypto";

/**
 * Minimal single-operator admin auth: one shared password (ADMIN_PASSWORD),
 * one signed session cookie. No user table, no OAuth, no password reset flow.
 *
 * This is a deliberate scope call, not laziness — see
 * docs/adr/0003-admin-auth.md for the tradeoff and what would change if a
 * second person (e.g. a helper baker) needed their own login.
 */

const COOKIE_NAME = "bakery_admin_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "SESSION_SECRET is not set (or too short). Refusing to issue admin sessions."
    );
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("hex");
}

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

export function createSessionCookieValue(): string {
  const expires = Date.now() + SESSION_TTL_MS;
  const payload = `${expires}`;
  const signature = sign(payload);
  return `${payload}.${signature}`;
}

export function isValidSessionCookieValue(value: string | undefined): boolean {
  if (!value) return false;
  const [payload, signature] = value.split(".");
  if (!payload || !signature) return false;
  if (sign(payload) !== signature) return false;
  const expires = Number(payload);
  if (Number.isNaN(expires)) return false;
  return Date.now() < expires;
}

export const ADMIN_SESSION_COOKIE_NAME = COOKIE_NAME;
export const ADMIN_SESSION_MAX_AGE_SECONDS = SESSION_TTL_MS / 1000;
