import { describe, expect, it } from "vitest";
import { validateOrder, type OrderInput } from "../../src/lib/orders";
import { earliestReadyDate } from "../../src/lib/cart";

function baseInput(overrides: Partial<OrderInput> = {}): OrderInput {
  return {
    customerName: "Jane Baker",
    customerEmail: "jane@example.com",
    customerPhone: "555-123-4567",
    fulfillmentMethod: "PICKUP",
    requestedDate: earliestReadyDate(),
    items: [{ productId: "p1", name: "Cookies", unitPriceCents: 2200, quantity: 1 }],
    ...overrides,
  };
}

describe("validateOrder", () => {
  it("accepts a well-formed pickup order", () => {
    const result = validateOrder(baseInput());
    expect(result.valid).toBe(true);
  });

  it("rejects a missing name", () => {
    const result = validateOrder(baseInput({ customerName: "  " }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("Name is required.");
  });

  it("rejects a malformed email", () => {
    const result = validateOrder(baseInput({ customerEmail: "not-an-email" }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("A valid email is required.");
    }
  });

  it("rejects an empty cart", () => {
    const result = validateOrder(baseInput({ items: [] }));
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.errors).toContain("Cart is empty.");
  });

  it("rejects a non-positive item quantity", () => {
    const result = validateOrder(
      baseInput({
        items: [{ productId: "p1", name: "Cookies", unitPriceCents: 2200, quantity: 0 }],
      })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Item quantities must be positive.");
    }
  });

  it("requires an address for local delivery", () => {
    const result = validateOrder(
      baseInput({ fulfillmentMethod: "LOCAL_DELIVERY", fulfillmentAddress: "" })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain(
        "A delivery address is required for local delivery."
      );
    }
  });

  it("does not require an address for pickup", () => {
    const result = validateOrder(baseInput({ fulfillmentMethod: "PICKUP" }));
    expect(result.valid).toBe(true);
  });

  it("accepts an in-state shipping address", () => {
    const result = validateOrder(
      baseInput({
        fulfillmentMethod: "IN_STATE_SHIPPING",
        fulfillmentAddress: "123 Main St, Sacramento, CA 95814",
      })
    );
    expect(result.valid).toBe(true);
  });

  it("rejects a shipping address with no California indicator", () => {
    const result = validateOrder(
      baseInput({
        fulfillmentMethod: "IN_STATE_SHIPPING",
        fulfillmentAddress: "123 Main St, Portland, OR 97201",
      })
    );
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("cottage food law"))).toBe(true);
    }
  });

  it("rejects a requested date before the minimum lead time", () => {
    const tooSoon = new Date();
    const result = validateOrder(baseInput({ requestedDate: tooSoon }));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.includes("baking lead time"))).toBe(true);
    }
  });
});
