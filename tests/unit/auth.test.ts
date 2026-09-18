import { createHmac } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

// auth.ts reads ADMIN_PASSWORD / SESSION_SECRET from process.env lazily
// (inside each function, not at module load time) specifically so tests
// can set fixture values before calling in — see src/lib/auth.ts.
beforeAll(() => {
  process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
  process.env.SESSION_SECRET = "test-secret-at-least-16-chars-long";
});

const {
  checkAdminPassword,
  createSessionCookieValue,
  isValidSessionCookieValue,
} = await import("@/lib/auth");

describe("checkAdminPassword", () => {
  it("accepts the correct password", () => {
    expect(checkAdminPassword("correct-horse-battery-staple")).toBe(true);
  });

  it("rejects an incorrect password", () => {
    expect(checkAdminPassword("wrong-password")).toBe(false);
  });

  it("rejects a password of different length without throwing", () => {
    expect(checkAdminPassword("short")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(checkAdminPassword("")).toBe(false);
  });
});

describe("session cookie signing", () => {
  it("treats a freshly created cookie value as valid", () => {
    const value = createSessionCookieValue();
    expect(isValidSessionCookieValue(value)).toBe(true);
  });

  it("rejects an undefined cookie", () => {
    expect(isValidSessionCookieValue(undefined)).toBe(false);
  });

  it("rejects a tampered payload (signature no longer matches)", () => {
    const value = createSessionCookieValue();
    const [, signature] = value.split(".");
    const tampered = `${Date.now() + 999999999}.${signature}`;
    expect(isValidSessionCookieValue(tampered)).toBe(false);
  });

  it("rejects a garbage string", () => {
    expect(isValidSessionCookieValue("not-a-real-cookie")).toBe(false);
  });

  it("rejects an expired cookie", () => {
    // Craft a cookie whose expiry is already in the past, signed with the
    // same HMAC the real implementation would use.
    const expiredPayload = `${Date.now() - 1000}`;
    const signature = createHmac("sha256", process.env.SESSION_SECRET!)
      .update(expiredPayload)
      .digest("hex");
    expect(isValidSessionCookieValue(`${expiredPayload}.${signature}`)).toBe(false);
  });
});
