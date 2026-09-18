import { describe, expect, it } from "vitest";
import {
  addToCart,
  cartItemCount,
  cartSubtotalCents,
  earliestReadyDate,
  formatCents,
  removeFromCart,
  updateQuantity,
  MIN_LEAD_TIME_DAYS,
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
  it("adds the minimum lead time to the given date", () => {
    // Built from local components (not a "Z"-suffixed ISO string) since
    // earliestReadyDate uses local-time setDate/getDate — an ISO UTC
    // midnight can land on the previous local day depending on timezone,
    // which would make this assertion flaky across environments.
    const from = new Date(2026, 0, 1); // Jan 1, 2026, local midnight
    const result = earliestReadyDate(from);
    expect(result.getDate()).toBe(1 + MIN_LEAD_TIME_DAYS);
  });
});
