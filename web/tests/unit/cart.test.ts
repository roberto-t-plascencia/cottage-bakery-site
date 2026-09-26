import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartItemCount,
  cartSubtotalCents,
  earliestReadyDate,
  formatCents,
  formatDateOnly,
  parseDateOnly,
  removeFromCart,
  toDateInputValue,
  updateQuantity,
  type CartLine,
} from "@/lib/cart";

const cookie = { productId: "p1", name: "Cookie", unitPriceCents: 500 };
const bread = { productId: "p2", name: "Bread", unitPriceCents: 900 };

describe("addToCart", () => {
  it("adds a new line item", () => {
    const result = addToCart([], cookie, 2);
    expect(result).toEqual<CartLine[]>([{ ...cookie, quantity: 2 }]);
  });

  it("merges quantity when the product is already in the cart", () => {
    const cart = addToCart([{ ...cookie, quantity: 2 }], cookie, 3);
    expect(cart).toEqual([{ ...cookie, quantity: 5 }]);
  });

  it("does not mutate the original cart array", () => {
    const original: CartLine[] = [{ ...cookie, quantity: 1 }];
    const result = addToCart(original, bread, 1);
    expect(original).toHaveLength(1);
    expect(result).toHaveLength(2);
  });

  it("rejects a non-positive quantity", () => {
    expect(() => addToCart([], cookie, 0)).toThrow();
    expect(() => addToCart([], cookie, -1)).toThrow();
  });
});

describe("removeFromCart", () => {
  it("removes only the matching line", () => {
    const cart = [{ ...cookie, quantity: 1 }, { ...bread, quantity: 1 }];
    expect(removeFromCart(cart, "p1")).toEqual([{ ...bread, quantity: 1 }]);
  });

  it("is a no-op if the product isn't in the cart", () => {
    const cart = [{ ...cookie, quantity: 1 }];
    expect(removeFromCart(cart, "does-not-exist")).toEqual(cart);
  });
});

describe("updateQuantity", () => {
  it("updates the quantity of an existing line", () => {
    const cart = [{ ...cookie, quantity: 1 }];
    expect(updateQuantity(cart, "p1", 4)).toEqual([{ ...cookie, quantity: 4 }]);
  });

  it("removes the line when quantity drops to zero or below", () => {
    const cart = [{ ...cookie, quantity: 1 }];
    expect(updateQuantity(cart, "p1", 0)).toEqual([]);
    expect(updateQuantity(cart, "p1", -3)).toEqual([]);
  });
});

describe("cartSubtotalCents / cartItemCount", () => {
  it("sums price * quantity across lines", () => {
    const cart = [{ ...cookie, quantity: 2 }, { ...bread, quantity: 3 }];
    // 2 * 500 + 3 * 900 = 3700
    expect(cartSubtotalCents(cart)).toBe(3700);
    expect(cartItemCount(cart)).toBe(5);
  });

  it("returns 0 for an empty cart", () => {
    expect(cartSubtotalCents([])).toBe(0);
    expect(cartItemCount([])).toBe(0);
  });
});

describe("formatCents", () => {
  it("formats whole dollars", () => {
    expect(formatCents(2200)).toBe("$22.00");
  });

  it("formats amounts with cents", () => {
    expect(formatCents(1999)).toBe("$19.99");
  });

  it("formats zero", () => {
    expect(formatCents(0)).toBe("$0.00");
  });
});

describe("earliestReadyDate", () => {
  // Exact instants ("Z" timestamps), since the rule now counts days in
  // the bakery's timezone regardless of where the test runs.
  it("is today before the 8 PM pickup cutoff", () => {
    const from = new Date("2026-01-01T20:00:00Z"); // noon, Jan 1, in San Diego
    expect(toDateInputValue(earliestReadyDate("PICKUP", from))).toBe("2026-01-01");
  });

  it("stays on the bakery's date in the evening, when UTC is already tomorrow", () => {
    // 7:59 PM Pacific on Sep 25 is 02:59 UTC on Sep 26: still Sep 25.
    const from = new Date("2026-09-26T02:59:00Z");
    expect(toDateInputValue(earliestReadyDate("PICKUP", from))).toBe("2026-09-25");
  });

  it("moves pickup to tomorrow at 8 PM, but keeps same-day delivery open until 9:30 PM", () => {
    const eightOhThree = new Date("2026-09-26T03:03:00Z"); // 8:03 PM Sep 25 in San Diego
    expect(toDateInputValue(earliestReadyDate("PICKUP", eightOhThree))).toBe("2026-09-26");
    expect(toDateInputValue(earliestReadyDate("LOCAL_DELIVERY", eightOhThree))).toBe("2026-09-25");

    const nineThirty = new Date("2026-09-26T04:30:00Z"); // 9:30 PM Sep 25 in San Diego
    expect(toDateInputValue(earliestReadyDate("LOCAL_DELIVERY", nineThirty))).toBe("2026-09-26");
  });
});

describe("toDateInputValue / parseDateOnly / formatDateOnly", () => {
  it("round-trips a local date through the input-value string unchanged", () => {
    const date = new Date(2026, 8, 21); // Sep 21, 2026, local midnight
    const str = toDateInputValue(date);
    expect(str).toBe("2026-09-21");
    const parsed = parseDateOnly(str);
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(8);
    expect(parsed.getDate()).toBe(21);
  });

  it("does not shift the date for single-digit months/days", () => {
    const date = new Date(2026, 0, 5); // Jan 5, 2026
    expect(toDateInputValue(date)).toBe("2026-01-05");
  });

  it("parseDateOnly never rolls back a day (the toISOString trap)", () => {
    // A naive `new Date("2026-09-21")` parses as UTC midnight, which in
    // any negative-UTC-offset timezone becomes Sep 20 in local time —
    // this is exactly the bug parseDateOnly exists to avoid. Whatever
    // timezone this test runs in, parsing must never move the date
    // backward from what was written.
    const parsed = parseDateOnly("2026-09-21");
    expect(parsed.getDate()).toBe(21);
  });

  it("formatDateOnly renders the same calendar date it was given", () => {
    expect(formatDateOnly("2026-09-21")).toBe(
      new Date(2026, 8, 21).toDateString()
    );
  });
});
