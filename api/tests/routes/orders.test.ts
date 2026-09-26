import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { FulfillmentMethod, PaymentStatus } from "../../src/lib/types";

// Route tests exercise HTTP behavior (status codes, the error envelope,
// auth enforcement) against the real Express app — but never a real
// database, and never a real PayPal API call. The repository layer and
// the PayPal client are both mocked here the same way a unit test mocks
// any I/O boundary; what's under test is routing/validation/auth wiring,
// which is exactly what a route test should cover per
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
  fulfillmentMethod: "PICKUP" as FulfillmentMethod,
  fulfillmentAddress: null,
  requestedDate: "2099-01-05",
  notes: null,
  status: "PENDING" as const,
  subtotalCents: 2200,
  deliveryFeeCents: 0,
  totalCents: 2200,
  paymentMethod: "MANUAL" as const,
  paymentStatus: "UNPAID" as PaymentStatus,
  paypalOrderId: null as string | null,
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

const setOrderPaymentMethod = vi.fn(async (_id: string, _method: string) => {});
const setOrderPayPalOrderId = vi.fn(async (_id: string, _paypalOrderId: string) => {});
const markOrderPaid = vi.fn(async (id: string, paypalOrderId: string) =>
  id === fakeOrder.id
    ? { ...fakeOrder, status: "CONFIRMED", paymentStatus: "PAID", paypalOrderId }
    : null
);
const createOrder = vi.fn(async (_input: { deliveryFeeCents: number }) => ({ ...fakeOrder }));
const getOrderById = vi.fn(async (id: string) => (id === fakeOrder.id ? fakeOrder : null));

vi.mock("../../src/lib/repositories/orders", () => ({
  createOrder: (...args: [{ deliveryFeeCents: number }]) => createOrder(...args),
  getOrderById: (...args: [string]) => getOrderById(...args),
  listOrders: vi.fn(async () => [fakeOrder]),
  updateOrderStatus: vi.fn(async (id: string, status: string) =>
    id === fakeOrder.id ? { ...fakeOrder, status } : null
  ),
  setOrderPaymentMethod: (...args: [string, string]) => setOrderPaymentMethod(...args),
  setOrderPayPalOrderId: (...args: [string, string]) => setOrderPayPalOrderId(...args),
  markOrderPaid: (...args: [string, string]) => markOrderPaid(...args),
}));

const createPayPalOrder = vi.fn(async (_amountCents: number, _orderId: string) => "PAYPAL-ORDER-ID");
const capturePayPalOrder = vi.fn(async (_paypalOrderId: string) => ({ captured: true, paypalOrderId: "PAYPAL-ORDER-ID" }));

vi.mock("../../src/lib/paypal", () => ({
  createPayPalOrder: (...args: [number, string]) => createPayPalOrder(...args),
  capturePayPalOrder: (...args: [string]) => capturePayPalOrder(...args),
}));

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";
});

beforeEach(() => {
  getOrderById.mockClear();
  createOrder.mockClear();
  getOrderById.mockImplementation(async (id: string) => (id === fakeOrder.id ? fakeOrder : null));
  createPayPalOrder.mockClear();
  capturePayPalOrder.mockClear();
  capturePayPalOrder.mockResolvedValue({ captured: true, paypalOrderId: "PAYPAL-ORDER-ID" });
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
    expect(res.body.order.paymentMethod).toBe("MANUAL");
  });

  it("computes the local-delivery fee server-side from its own subtotal", async () => {
    const app = createApp();
    const delivery = (quantity: number) =>
      request(app)
        .post("/orders")
        .send({
          customerName: "Jane Baker",
          customerEmail: "jane@example.com",
          customerPhone: "555-123-4567",
          fulfillmentMethod: "LOCAL_DELIVERY",
          fulfillmentAddress: "123 Main St, San Diego, CA 92108",
          requestedDate: "2099-01-05",
          items: [{ productId: products[0].id, quantity }],
          // Anything the client sends about fees must be ignored.
          deliveryFeeCents: 0,
        });

    // 1 x $22.00 is under the $25 threshold: fee applies.
    expect((await delivery(1)).status).toBe(201);
    expect(createOrder).toHaveBeenLastCalledWith(expect.objectContaining({ deliveryFeeCents: 300 }));

    // 2 x $22.00 clears it: free delivery.
    expect((await delivery(2)).status).toBe(201);
    expect(createOrder).toHaveBeenLastCalledWith(expect.objectContaining({ deliveryFeeCents: 0 }));
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

  it("marks the order PAYPAL when the buyer chose to pay online", async () => {
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
        paymentMethod: "PAYPAL",
      });

    expect(res.status).toBe(201);
    expect(res.body.order.paymentMethod).toBe("PAYPAL");
    expect(setOrderPaymentMethod).toHaveBeenCalledWith(fakeOrder.id, "PAYPAL");
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

describe("POST /orders/:id/paypal-order", () => {
  it("creates a PayPal order sized to the order's own total", async () => {
    const app = createApp();
    const res = await request(app).post(`/orders/${fakeOrder.id}/paypal-order`).send();

    expect(res.status).toBe(200);
    expect(res.body.paypalOrderId).toBe("PAYPAL-ORDER-ID");
    expect(createPayPalOrder).toHaveBeenCalledWith(fakeOrder.totalCents, fakeOrder.id);
  });

  it("includes the stored delivery fee in the PayPal amount", async () => {
    getOrderById.mockResolvedValueOnce({
      ...fakeOrder,
      fulfillmentMethod: "LOCAL_DELIVERY",
      deliveryFeeCents: 300,
      totalCents: 2500,
    });
    const app = createApp();
    const res = await request(app).post(`/orders/${fakeOrder.id}/paypal-order`).send();

    expect(res.status).toBe(200);
    expect(createPayPalOrder).toHaveBeenCalledWith(2500, fakeOrder.id);
  });

  it("404s for an order that doesn't exist", async () => {
    const app = createApp();
    const res = await request(app).post("/orders/does-not-exist/paypal-order").send();
    expect(res.status).toBe(404);
  });

  it("400s if the order is already paid", async () => {
    getOrderById.mockResolvedValueOnce({ ...fakeOrder, paymentStatus: "PAID" });
    const app = createApp();
    const res = await request(app).post(`/orders/${fakeOrder.id}/paypal-order`).send();
    expect(res.status).toBe(400);
  });
});

describe("POST /orders/:id/capture-payment", () => {
  it("captures payment and returns the updated, CONFIRMED order", async () => {
    getOrderById.mockResolvedValueOnce({ ...fakeOrder, paypalOrderId: "PAYPAL-ORDER-ID" });
    const app = createApp();
    const res = await request(app)
      .post(`/orders/${fakeOrder.id}/capture-payment`)
      .send({ paypalOrderId: "PAYPAL-ORDER-ID" });

    expect(res.status).toBe(200);
    expect(res.body.order.paymentStatus).toBe("PAID");
    expect(res.body.order.status).toBe("CONFIRMED");
  });

  it("400s when the PayPal order id doesn't match this order's", async () => {
    getOrderById.mockResolvedValueOnce({ ...fakeOrder, paypalOrderId: "SOME-OTHER-ID" });
    const app = createApp();
    const res = await request(app)
      .post(`/orders/${fakeOrder.id}/capture-payment`)
      .send({ paypalOrderId: "PAYPAL-ORDER-ID" });

    expect(res.status).toBe(400);
  });

  it("400s when PayPal reports the capture wasn't completed", async () => {
    getOrderById.mockResolvedValueOnce({ ...fakeOrder, paypalOrderId: "PAYPAL-ORDER-ID" });
    capturePayPalOrder.mockResolvedValueOnce({ captured: false, paypalOrderId: "PAYPAL-ORDER-ID" });
    const app = createApp();
    const res = await request(app)
      .post(`/orders/${fakeOrder.id}/capture-payment`)
      .send({ paypalOrderId: "PAYPAL-ORDER-ID" });

    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("is idempotent for an order that's already been captured", async () => {
    getOrderById.mockResolvedValueOnce({
      ...fakeOrder,
      paypalOrderId: "PAYPAL-ORDER-ID",
      paymentStatus: "PAID",
    });
    const app = createApp();
    const res = await request(app)
      .post(`/orders/${fakeOrder.id}/capture-payment`)
      .send({ paypalOrderId: "PAYPAL-ORDER-ID" });

    expect(res.status).toBe(200);
    expect(capturePayPalOrder).not.toHaveBeenCalled();
  });
});
