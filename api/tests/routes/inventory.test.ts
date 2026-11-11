import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

const SOURDOUGH = "11111111-1111-1111-1111-111111111111";
const UNKNOWN = "99999999-9999-9999-9999-999999999999";

const dayInventory = (startQuantity: number | null, ordered = 0) => ({
  productId: SOURDOUGH,
  date: "2026-11-12",
  startQuantity,
  ordered,
  remaining: startQuantity === null ? null : Math.max(0, startQuantity - ordered),
});

const listDayInventory = vi.fn(async (date: string) => [
  { ...dayInventory(10, 3), date, product: { id: SOURDOUGH, name: "Sourdough" } },
]);
// Mirrors the repository's contract: null for a product that doesn't
// exist, which is what the route turns into a 404.
const setStartQuantity = vi.fn(async (id: string, date: string, startQuantity: number) =>
  id === SOURDOUGH ? { ...dayInventory(startQuantity), date } : null
);
const clearStartQuantity = vi.fn(async (id: string, date: string) =>
  id === SOURDOUGH ? { ...dayInventory(null), date } : null
);

vi.mock("../../src/lib/repositories/inventory", () => ({
  listDayInventory: (...args: [string]) => listDayInventory(...args),
  setStartQuantity: (...args: [string, string, number]) => setStartQuantity(...args),
  clearStartQuantity: (...args: [string, string]) => clearStartQuantity(...args),
  availabilityForDate: vi.fn(async () => new Map()),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";
});

beforeEach(() => {
  vi.clearAllMocks();
});

const { createApp } = await import("../../src/app");
const { issueAdminToken } = await import("../../src/lib/auth");

const auth = () => `Bearer ${issueAdminToken()}`;

describe("GET /products/inventory", () => {
  it("requires an admin token", async () => {
    const res = await request(createApp()).get("/products/inventory?date=2026-11-12");
    expect(res.status).toBe(401);
  });

  it("returns the day's inventory", async () => {
    const res = await request(createApp())
      .get("/products/inventory?date=2026-11-12")
      .set("Authorization", auth());

    expect(res.status).toBe(200);
    expect(res.body.date).toBe("2026-11-12");
    expect(listDayInventory).toHaveBeenCalledWith("2026-11-12");
    expect(res.body.inventory[0]).toMatchObject({ startQuantity: 10, ordered: 3, remaining: 7 });
  });

  it("rejects a missing date", async () => {
    const res = await request(createApp()).get("/products/inventory").set("Authorization", auth());
    expect(res.status).toBe(400);
    expect(res.body.errors).toBeInstanceOf(Array);
  });

  it("rejects a date that isn't YYYY-MM-DD", async () => {
    // Anything this route would otherwise hand to Postgres as a `date`,
    // including the US-style form a human might type by hand.
    const res = await request(createApp())
      .get("/products/inventory?date=11/12/2026")
      .set("Authorization", auth());
    expect(res.status).toBe(400);
    expect(listDayInventory).not.toHaveBeenCalled();
  });
});

describe("PUT /products/:id/inventory", () => {
  const url = `/products/${SOURDOUGH}/inventory`;

  it("requires an admin token", async () => {
    const res = await request(createApp()).put(url).send({ date: "2026-11-12", startQuantity: 10 });
    expect(res.status).toBe(401);
  });

  it("sets the day's starting quantity", async () => {
    const res = await request(createApp())
      .put(url)
      .set("Authorization", auth())
      .send({ date: "2026-11-12", startQuantity: 10 });

    expect(res.status).toBe(200);
    expect(setStartQuantity).toHaveBeenCalledWith(SOURDOUGH, "2026-11-12", 10);
    expect(res.body.inventory.startQuantity).toBe(10);
  });

  it("accepts 0 as a real cap, not as 'clear it'", async () => {
    const res = await request(createApp())
      .put(url)
      .set("Authorization", auth())
      .send({ date: "2026-11-12", startQuantity: 0 });

    expect(res.status).toBe(200);
    expect(setStartQuantity).toHaveBeenCalledWith(SOURDOUGH, "2026-11-12", 0);
    expect(clearStartQuantity).not.toHaveBeenCalled();
  });

  it("clears the cap back to unlimited with null", async () => {
    const res = await request(createApp())
      .put(url)
      .set("Authorization", auth())
      .send({ date: "2026-11-12", startQuantity: null });

    expect(res.status).toBe(200);
    expect(clearStartQuantity).toHaveBeenCalledWith(SOURDOUGH, "2026-11-12");
    expect(setStartQuantity).not.toHaveBeenCalled();
    expect(res.body.inventory.startQuantity).toBeNull();
  });

  it("rejects a negative quantity", async () => {
    const res = await request(createApp())
      .put(url)
      .set("Authorization", auth())
      .send({ date: "2026-11-12", startQuantity: -1 });
    expect(res.status).toBe(400);
    expect(setStartQuantity).not.toHaveBeenCalled();
  });

  it("rejects a fractional quantity", async () => {
    const res = await request(createApp())
      .put(url)
      .set("Authorization", auth())
      .send({ date: "2026-11-12", startQuantity: 2.5 });
    expect(res.status).toBe(400);
  });

  it("rejects a body with no date", async () => {
    const res = await request(createApp())
      .put(url)
      .set("Authorization", auth())
      .send({ startQuantity: 10 });
    expect(res.status).toBe(400);
  });

  it("404s for an unknown product", async () => {
    const res = await request(createApp())
      .put(`/products/${UNKNOWN}/inventory`)
      .set("Authorization", auth())
      .send({ date: "2026-11-12", startQuantity: 10 });
    expect(res.status).toBe(404);
  });
});
