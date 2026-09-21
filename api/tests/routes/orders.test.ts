import { beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";

// Route tests exercise HTTP behavior (status codes, the error envelope,
// auth enforcement) against the real Express app — but never a real
// database. The repository layer is mocked here the same way a unit
// test mocks any I/O boundary; what's under test is routing/validation/
// auth wiring, which is exactly what a route test should cover per
// specs/ENGINEERING_RULES.md "Testing bar."
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

const fakeOrder = {
  id: "22222222-2222-2222-2222-222222222222",
  customerName: "Jane Baker",
  customerEmail: "jane@example.com",
  customerPhone: "555-123-4567",
  fulfillmentMethod: "PICKUP" as const,
  fulfillmentAddress: null,
  requestedDate: "2099-01-05",
  notes: null,
  status: "PENDING" as const,
  subtotalCents: 2200,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  items: [
    {
      id: "33333333-3333-3333-3333-333333333333",
      orderId: "22222222-2222-2222-2222-222222222222",
      productId: products[0].id,
      quantity: 1,
      unitPriceCents: 2200,
      product: products[0],
    },
  ],
};

vi.mock("../../src/lib/repositories/products", () => ({
  findProductsByIds: vi.fn(async (ids: string[]) =>
    products.filter((p) => ids.includes(p.id))
  ),
  listActiveProducts: vi.fn(async () => products),
}));

vi.mock("../../src/lib/repositories/orders", () => ({
  createOrder: vi.fn(async () => fakeOrder),
  getOrderById: vi.fn(async (id: string) => (id === fakeOrder.id ? fakeOrder : null)),
  listOrders: vi.fn(async () => [fakeOrder]),
  updateOrderStatus: vi.fn(async (id: string, status: string) =>
    id === fakeOrder.id ? { ...fakeOrder, status } : null
  ),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";
});

const { createApp } = await import("../../src/app");
const { issueAdminToken } = await import("../../src/lib/auth");

describe("POST /orders", () => {
  it("creates an order for a well-formed request", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/orders")
      .send({
        customerName: "Jane Baker",
        customerEmail: "jane@example.com",
        customerPhone: "555-123-4567",
        fulfillmentMethod: "PICKUP",
        requestedDate: "2099-01-05",
        items: [{ productId: products[0].id, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.order.id).toBe(fakeOrder.id);
  });

  it("returns the standard error envelope for an empty cart", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/orders")
      .send({
        customerName: "Jane Baker",
        customerEmail: "jane@example.com",
        customerPhone: "555-123-4567",
        fulfillmentMethod: "PICKUP",
        requestedDate: "2099-01-05",
        items: [],
      });

    expect(res.status).toBe(400);
    expect(Array.isArray(res.body.errors)).toBe(true);
  });

  it("rejects an order referencing an unknown product", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/orders")
      .send({
        customerName: "Jane Baker",
        customerEmail: "jane@example.com",
        customerPhone: "555-123-4567",
        fulfillmentMethod: "PICKUP",
        requestedDate: "2099-01-05",
        items: [{ productId: "does-not-exist", quantity: 1 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/no longer available/);
  });
});

describe("GET /orders/:id", () => {
  it("returns the order when found", async () => {
    const app = createApp();
    const res = await request(app).get(`/orders/${fakeOrder.id}`);
    expect(res.status).toBe(200);
    expect(res.body.order.id).toBe(fakeOrder.id);
  });

  it("404s with the standard envelope when not found", async () => {
    const app = createApp();
    const res = await request(app).get("/orders/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ errors: expect.any(Array) });
  });
});

describe("GET /orders (admin)", () => {
  it("401s without a bearer token", async () => {
    const app = createApp();
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
  });

  it("401s with a garbage token", async () => {
    const app = createApp();
    const res = await request(app).get("/orders").set("Authorization", "Bearer garbage");
    expect(res.status).toBe(401);
  });

  it("returns orders with a valid admin token", async () => {
    const app = createApp();
    const token = issueAdminToken();
    const res = await request(app).get("/orders").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.orders).toHaveLength(1);
  });
});

describe("PATCH /orders/:id/status (admin)", () => {
  it("401s without a token", async () => {
    const app = createApp();
    const res = await request(app).patch(`/orders/${fakeOrder.id}/status`).send({ status: "CONFIRMED" });
    expect(res.status).toBe(401);
  });

  it("updates status with a valid token", async () => {
    const app = createApp();
    const token = issueAdminToken();
    const res = await request(app)
      .patch(`/orders/${fakeOrder.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "CONFIRMED" });

    expect(res.status).toBe(200);
    expect(res.body.order.status).toBe("CONFIRMED");
  });

  it("400s on an invalid status even with a valid token", async () => {
    const app = createApp();
    const token = issueAdminToken();
    const res = await request(app)
      .patch(`/orders/${fakeOrder.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "NOT_A_REAL_STATUS" });

    expect(res.status).toBe(400);
  });
});
