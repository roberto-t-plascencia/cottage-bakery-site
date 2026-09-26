import { afterEach, describe, expect, it, vi } from "vitest";
import { validateOrder } from "../../src/lib/orders";
import { parseDateOnly } from "../../src/lib/cart";

// The server must count days in the bakery's timezone, not in UTC (which
// is what Vercel runs in), and allow same-day orders until 8 PM there
// (9:30 PM for local delivery).
// See BAKERY_TIME_ZONE and SAME_DAY_CUTOFF_HOUR in src/lib/cart.ts.
function orderFor(requestedDate: string, fulfillmentMethod: "PICKUP" | "LOCAL_DELIVERY" = "PICKUP") {
  return validateOrder({
    customerName: "Jane Baker",
    customerEmail: "jane@example.com",
    customerPhone: "555-123-4567",
    fulfillmentMethod,
    fulfillmentAddress: "123 Main St, San Diego, CA 92108",
    requestedDate: parseDateOnly(requestedDate),
    items: [{ productId: "p1", name: "Cookies", unitPriceCents: 2200, quantity: 1 }],
  });
}

describe("same-day ordering, Pacific time", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows today before the 8 PM cutoff, even though UTC is already tomorrow", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T02:59:00Z")); // 7:59 PM Sep 25 in San Diego
    expect(orderFor("2026-09-25").valid).toBe(true);
  });

  it("closes same-day pickup at 8 PM but keeps same-day delivery open", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T03:03:00Z")); // 8:03 PM Sep 25 in San Diego
    expect(orderFor("2026-09-25").valid).toBe(false);
    expect(orderFor("2026-09-26").valid).toBe(true);
    expect(orderFor("2026-09-25", "LOCAL_DELIVERY").valid).toBe(true);
  });

  it("closes same-day delivery at 9:30 PM", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-26T04:30:00Z")); // 9:30 PM Sep 25 in San Diego
    expect(orderFor("2026-09-25", "LOCAL_DELIVERY").valid).toBe(false);
    expect(orderFor("2026-09-26", "LOCAL_DELIVERY").valid).toBe(true);
  });
});
