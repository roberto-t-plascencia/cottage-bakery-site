import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

const products = [
  {
    id: "11111111-1111-1111-1111-111111111111",
    slug: "cookies",
    name: "Cookies",
    description: "desc",
    priceCents: 2200,
    category: "Cookies",
    imageUrl: null,
    allergens: "",
    ingredients: "",
    netWeight: "",
    isActive: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
];

const setProductSoldOutOn = vi.fn(async (id: string, date: string | null) =>
  id === products[0].id ? { ...products[0], soldOutOn: date, soldOutToday: date !== null } : null
);

vi.mock("../../src/lib/repositories/products", () => ({
  listActiveProducts: vi.fn(async () => products),
  findProductsByIds: vi.fn(async () => []),
  setProductSoldOutOn: (...args: [string, string | null]) => setProductSoldOutOn(...args),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";
});

const { createApp } = await import("../../src/app");
const { issueAdminToken } = await import("../../src/lib/auth");
const { bakeryToday } = await import("../../src/lib/cart");

describe("GET /products", () => {
  it("returns active products", async () => {
    const app = createApp();
    const res = await request(app).get("/products");
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].slug).toBe("cookies");
  });
});

describe("PATCH /products/:id/sold-out", () => {
  const url = `/products/${products[0].id}/sold-out`;

  it("requires an admin token", async () => {
    const res = await request(createApp()).patch(url).send({ soldOutToday: true });
    expect(res.status).toBe(401);
  });

  it("marks the product sold out for today's bakery date", async () => {
    const res = await request(createApp())
      .patch(url)
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .send({ soldOutToday: true });
    expect(res.status).toBe(200);
    expect(setProductSoldOutOn).toHaveBeenLastCalledWith(products[0].id, bakeryToday());
    expect(res.body.product.soldOutToday).toBe(true);
  });

  it("clears it", async () => {
    const res = await request(createApp())
      .patch(url)
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .send({ soldOutToday: false });
    expect(res.status).toBe(200);
    expect(setProductSoldOutOn).toHaveBeenLastCalledWith(products[0].id, null);
  });

  it("rejects a body without a boolean", async () => {
    const res = await request(createApp())
      .patch(url)
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .send({ soldOutToday: "yes" });
    expect(res.status).toBe(400);
  });

  it("404s for an unknown product", async () => {
    const res = await request(createApp())
      .patch("/products/99999999-9999-9999-9999-999999999999/sold-out")
      .set("Authorization", `Bearer ${issueAdminToken()}`)
      .send({ soldOutToday: true });
    expect(res.status).toBe(404);
  });
});

describe("unknown routes", () => {
  it("404s with the standard error envelope", async () => {
    const app = createApp();
    const res = await request(app).get("/not-a-real-route");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errors: expect.any(Array) });
  });
});
