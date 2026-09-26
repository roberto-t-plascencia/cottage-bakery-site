import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

beforeAll(() => {
  process.env.PAYPAL_CLIENT_ID = "test-client-id";
  process.env.PAYPAL_CLIENT_SECRET = "test-client-secret";
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("createPayPalOrder", () => {
  it("charges our stored total and tells PayPal not to collect a shipping address", async () => {
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url.endsWith("/v1/oauth2/token")) {
        return new Response(JSON.stringify({ access_token: "token", expires_in: 3600 }));
      }
      return new Response(JSON.stringify({ id: "PAYPAL-ORDER-ID" }), { status: 201 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const { createPayPalOrder } = await import("../../src/lib/paypal");
    const id = await createPayPalOrder(1797, "order-1");

    expect(id).toBe("PAYPAL-ORDER-ID");
    const orderCall = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/v2/checkout/orders"));
    const body = JSON.parse(String(orderCall?.[1]?.body));
    expect(body.purchase_units[0]).toMatchObject({
      reference_id: "order-1",
      amount: { currency_code: "USD", value: "17.97" },
    });
    expect(body.application_context.shipping_preference).toBe("NO_SHIPPING");
  });
});
