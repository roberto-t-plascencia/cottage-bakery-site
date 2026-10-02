import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { OrderWithItems } from "../../src/lib/types";

const sendMock = vi.fn(async (_payload: Record<string, unknown>) => ({ data: { id: "email-1" }, error: null }));
vi.mock("resend", () => ({
  Resend: class {
    emails = { send: (payload: Record<string, unknown>) => sendMock(payload) };
  },
}));

const order = {
  id: "22222222-2222-2222-2222-222222222222",
  customerName: "Jane <b>Baker</b>",
  customerEmail: "jane@example.com",
  customerPhone: "(858) 555-0123",
  fulfillmentMethod: "LOCAL_DELIVERY",
  fulfillmentAddress: "123 Main St, San Diego, CA 92108",
  requestedDate: "2099-01-05",
  notes: "Ring twice <script>alert(1)</script>",
  status: "PENDING",
  subtotalCents: 1198,
  deliveryFeeCents: 300,
  totalCents: 1498,
  paymentMethod: "MANUAL",
  paymentStatus: "UNPAID",
  paypalOrderId: null,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  items: [
    {
      id: "i1",
      orderId: "22222222-2222-2222-2222-222222222222",
      productId: "p1",
      quantity: 2,
      unitPriceCents: 599,
      product: { name: "Pan de Masa Madre" },
    },
  ],
} as unknown as OrderWithItems;

beforeEach(() => {
  process.env.RESEND_API_KEY = "test-key";
  sendMock.mockClear();
});

afterEach(() => {
  delete process.env.ORDER_NOTIFICATION_EMAILS;
  delete process.env.VERCEL_ENV;
});

describe("sendNewOrderNotification", () => {
  it("emails everyone on the list, with Reply-To set to the customer", async () => {
    process.env.ORDER_NOTIFICATION_EMAILS = " owner@example.com, partner@example.com ,";
    const { sendNewOrderNotification } = await import("../../src/lib/email");
    await sendNewOrderNotification(order);

    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = sendMock.mock.calls[0][0];
    expect(payload.to).toEqual(["owner@example.com", "partner@example.com"]);
    expect(payload.replyTo).toBe("jane@example.com");
    expect(payload.subject).toMatch(/^New order: Jane <b>Baker<\/b> — \$14\.98, local delivery/);
    const html = String(payload.html);
    expect(html).toContain("2 × Pan de Masa Madre");
    expect(html).toContain("123 Main St, San Diego, CA 92108");
    expect(html).toContain("$14.98 to collect");
    expect(html).toContain('href="tel:8585550123"');
  });

  it("escapes what the customer typed", async () => {
    process.env.ORDER_NOTIFICATION_EMAILS = "owner@example.com";
    const { sendNewOrderNotification } = await import("../../src/lib/email");
    await sendNewOrderNotification(order);
    const html = String(sendMock.mock.calls[0][0].html);
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("Jane &lt;b&gt;Baker&lt;/b&gt;");
  });

  it("labels Preview alerts so test orders stand out", async () => {
    process.env.ORDER_NOTIFICATION_EMAILS = "owner@example.com";
    process.env.VERCEL_ENV = "preview";
    const { sendNewOrderNotification } = await import("../../src/lib/email");
    await sendNewOrderNotification(order);
    expect(String(sendMock.mock.calls[0][0].subject)).toMatch(/^\[Preview\] New order/);
  });

  it("sends nothing when no recipients are configured", async () => {
    const { sendNewOrderNotification } = await import("../../src/lib/email");
    await sendNewOrderNotification(order);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
