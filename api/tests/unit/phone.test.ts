import { describe, expect, it } from "vitest";
import { normalizeUsPhone } from "../../src/lib/phone";
import { validateOrder } from "../../src/lib/orders";
import { earliestReadyDate } from "../../src/lib/cart";

describe("normalizeUsPhone", () => {
  it("formats any 10-digit US number as (###) ###-####", () => {
    expect(normalizeUsPhone("8583739363")).toBe("(858) 373-9363");
    expect(normalizeUsPhone("858-373-9363")).toBe("(858) 373-9363");
    expect(normalizeUsPhone("+1 (858) 373-9363")).toBe("(858) 373-9363");
  });

  it("rejects numbers that aren't 10 digits", () => {
    expect(normalizeUsPhone("373-9363")).toBeNull();
    expect(normalizeUsPhone("858373936312")).toBeNull();
  });
});

describe("validateOrder phone check", () => {
  it("rejects a short phone number", () => {
    const result = validateOrder({
      customerName: "Jane Baker",
      customerEmail: "jane@example.com",
      customerPhone: "373-9363",
      fulfillmentMethod: "PICKUP",
      requestedDate: earliestReadyDate(),
      items: [{ productId: "p1", name: "Cookies", unitPriceCents: 2200, quantity: 1 }],
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors).toContain("Enter a 10-digit phone number, like (858) 373-9363.");
    }
  });
});
