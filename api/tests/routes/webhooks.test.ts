import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { PaymentStatus } from "../../src/lib/types";
import type { WebhookSignatureParams } from "../../src/lib/paypal";

// Full Order shape (not just the id/paymentStatus/paypalOrderId this
// file used before) -- markOrderPaid's real return now also feeds
// sendPaymentConfirmedEmail (see src/routes/webhooks.ts), which reads
// customerName/customerEmail/subtotalCents/requestedDate. A real DB row
// always has these; a minimal mock here doesn't, so the "marks the
// order paid" test below was throwing inside parseDateOnly(undefined)
// -- a test-fixture gap, not a production bug (see orders.test.ts's
// fakeOrder for the same full-shape pattern already used there).
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
  paymentMethod: "MANUAL" as const,
  paymentStatus: "UNPAID" as PaymentStatus,
  paypalOrderId: "PAYPAL-ORDER-ID" as string | null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

const getOrderByPayPalOrderId = vi.fn(async (id: string) =>
  id === fakeOrder.paypalOrderId ? fakeOrder : null
);
const markOrderPaid = vi.fn(async (_id: string, _paypalOrderId: string) => ({ ...fakeOrder, paymentStatus: "PAID" as PaymentStatus }));

vi.mock("../../src/lib/repositories/orders", () => ({
  getOrderByPayPalOrderId: (...args: [string]) => getOrderByPayPalOrderId(...args),
  markOrderPaid: (...args: [string, string]) => markOrderPaid(...args),
}));

// app.ts wires up every router unconditionally (see src/app.ts), including
// productsRouter — which pulls in the real repositories/products.ts (and,
// through it, the real Supabase client) unless mocked here too, same as
// orders.test.ts and products.test.ts already do for their own imports.
vi.mock("../../src/lib/repositories/products", () => ({
  listActiveProducts: vi.fn(async () => []),
  findProductsByIds: vi.fn(async () => []),
}));

const verifyWebhookSignature = vi.fn(async (_params: WebhookSignatureParams) => true);
vi.mock("../../src/lib/paypal", () => ({
  verifyWebhookSignature: (...args: [WebhookSignatureParams]) => verifyWebhookSignature(...args),
}));

const SIGNATURE_HEADERS = {
  "paypal-auth-algo": "SHA256withRSA",
  "paypal-cert-url": "https://api.sandbox.paypal.com/cert",
  "paypal-transmission-id": "abc-123",
  "paypal-transmission-sig": "sig",
  "paypal-transmission-time": "2026-01-01T00:00:00Z",
};

beforeAll(() => {
  process.env.JWT_SECRET = "test-secret-at-least-16-chars-long";
});

beforeEach(() => {
  verifyWebhookSignature.mockClear();
  verifyWebhookSignature.mockResolvedValue(true);
  getOrderByPayPalOrderId.mockClear();
  markOrderPaid.mockClear();
});

const { createApp } = await import("../../src/app");

describe("POST /webhooks/paypal", () => {
  it("400s when signature headers are missing", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/webhooks/paypal")
      .send({ event_type: "PAYMENT.CAPTURE.COMPLETED" });

    expect(res.status).toBe(400);
    expect(verifyWebhookSignature).not.toHaveBeenCalled();
  });

  it("400s when PayPal's signature verification fails", async () => {
    verifyWebhookSignature.mockResolvedValueOnce(false);
    const app = createApp();
    const res = await request(app)
      .post("/webhooks/paypal")
      .set(SIGNATURE_HEADERS)
      .send({ event_type: "PAYMENT.CAPTURE.COMPLETED" });

    expect(res.status).toBe(400);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("marks the order paid on a verified PAYMENT.CAPTURE.COMPLETED event", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/webhooks/paypal")
      .set(SIGNATURE_HEADERS)
      .send({
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          supplementary_data: { related_ids: { order_id: fakeOrder.paypalOrderId } },
        },
      });

    expect(res.status).toBe(200);
    expect(getOrderByPayPalOrderId).toHaveBeenCalledWith(fakeOrder.paypalOrderId);
    expect(markOrderPaid).toHaveBeenCalledWith(fakeOrder.id, fakeOrder.paypalOrderId);
  });

  it("does not re-mark an already-paid order (idempotent)", async () => {
    getOrderByPayPalOrderId.mockResolvedValueOnce({ ...fakeOrder, paymentStatus: "PAID" });
    const app = createApp();
    const res = await request(app)
      .post("/webhooks/paypal")
      .set(SIGNATURE_HEADERS)
      .send({
        event_type: "PAYMENT.CAPTURE.COMPLETED",
        resource: {
          supplementary_data: { related_ids: { order_id: fakeOrder.paypalOrderId } },
        },
      });

    expect(res.status).toBe(200);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("acknowledges a PAYMENT.CAPTURE.DENIED event without changing anything", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/webhooks/paypal")
      .set(SIGNATURE_HEADERS)
      .send({
        event_type: "PAYMENT.CAPTURE.DENIED",
        resource: {
          supplementary_data: { related_ids: { order_id: fakeOrder.paypalOrderId } },
        },
      });

    expect(res.status).toBe(200);
    expect(markOrderPaid).not.toHaveBeenCalled();
  });

  it("200s and ignores an event type it doesn't act on", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/webhooks/paypal")
      .set(SIGNATURE_HEADERS)
      .send({ event_type: "SOME.OTHER.EVENT" });

    expect(res.status).toBe(200);
    expect(getOrderByPayPalOrderId).not.toHaveBeenCalled();
  });
});
