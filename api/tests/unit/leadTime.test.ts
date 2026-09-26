import { afterEach, describe, expect, it, vi } from "vitest";
import { validateOrder } from "../../src/lib/orders";
import { parseDateOnly } from "../../src/lib/cart";

// The server must count lead time in the bakery's timezone, not in UTC
// (which is what Vercel runs in). See BAKERY_TIME_ZONE in src/lib/cart.ts.
function orderFor(requestedDate: string) {
  return validateOrder({
    customerName: "Jane Baker",
    customerEmail: "jane@example.com",
    customerPhone: "555-123-4567",
    fulfillmentMethod: "PICKUP",
    requestedDate: parseDateOnly(requestedDate),
    items: [{ productId: "p1", name: "Cookies", unitPriceCents: 2200, quantity: 1 }],
  });
}

describe("lead-time rule in the evening, Pacific time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("accepts the bakery's today + 2 even though UTC is already tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T03:03:00Z")); // 8:03 PM Sep 25 in San Diego
    expect(orderFor("2026-09-27").valid).toBe(true);
  });

  it("still rejects a date inside the lead time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T03:03:00Z"));
    expect(orderFor("2026-09-26").valid).toBe(false);
  });
});
