import { beforeAll, describe, expect, it } from "vitest";

// auth.ts reads ADMIN_PASSWORD / JWT_SECRET from process.env lazily
// (inside each function, not at module load time) specifically so tests
// can set fixture values before calling in — see src/lib/auth.ts.
beforeAll(() => {
  process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
  process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";
});

const { checkAdminPassword, issueAdminToken, verifyAdminToken } = await import(
  "../../src/lib/auth"
);

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

describe("admin JWTs", () => {
  it("treats a freshly issued token as valid", () => {
    const token = issueAdminToken();
    expect(verifyAdminToken(token)).toBe(true);
  });

  it("rejects an undefined token", () => {
    expect(verifyAdminToken(undefined)).toBe(false);
  });

  it("rejects a garbage string", () => {
    expect(verifyAdminToken("not-a-real-token")).toBe(false);
  });

  it("rejects a token signed with a different secret", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const forged = jwt.sign({ role: "admin" }, "a-completely-different-secret", {
      expiresIn: "1h",
    });
    expect(verifyAdminToken(forged)).toBe(false);
  });

  it("rejects an expired token", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const expired = jwt.sign({ role: "admin" }, process.env.JWT_SECRET!, {
      expiresIn: -1, // already expired
    });
    expect(verifyAdminToken(expired)).toBe(false);
  });

  it("rejects a validly signed token that doesn't claim the admin role", async () => {
    const jwt = (await import("jsonwebtoken")).default;
    const notAdmin = jwt.sign({ role: "customer" }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });
    expect(verifyAdminToken(notAdmin)).toBe(false);
  });
});
