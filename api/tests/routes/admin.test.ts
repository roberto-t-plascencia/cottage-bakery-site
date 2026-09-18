import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";

beforeAll(() => {
  process.env.ADMIN_PASSWORD = "correct-horse-battery-staple";
  process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";
});

const { createApp } = await import("../../src/app");

describe("POST /admin/login", () => {
  it("returns a token for the correct password", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/admin/login")
      .send({ password: "correct-horse-battery-staple" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
  });

  it("rejects an incorrect password with the standard error envelope", async () => {
    const app = createApp();
    const res = await request(app).post("/admin/login").send({ password: "wrong" });

    expect(res.status).toBe(401);
    expect(res.body).toEqual({ errors: expect.any(Array) });
  });

  it("rejects a missing password", async () => {
    const app = createApp();
    const res = await request(app).post("/admin/login").send({});
    expect(res.status).toBe(401);
  });
});
