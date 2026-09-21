import { describe, expect, it, vi } from "vitest";
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

vi.mock("../../src/lib/repositories/products", () => ({
  listActiveProducts: vi.fn(async () => products),
  findProductsByIds: vi.fn(async () => []),
}));

const { createApp } = await import("../../src/app");

describe("GET /products", () => {
  it("returns active products", async () => {
    const app = createApp();
    const res = await request(app).get("/products");
    expect(res.status).toBe(200);
    expect(res.body.products).toHaveLength(1);
    expect(res.body.products[0].slug).toBe("cookies");
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
