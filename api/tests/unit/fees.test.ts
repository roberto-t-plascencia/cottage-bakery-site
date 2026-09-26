import { describe, expect, it } from "vitest";
import {
  FREE_DELIVERY_MIN_SUBTOTAL_CENTS,
  LOCAL_DELIVERY_FEE_CENTS,
  deliveryFeeCents,
} from "../../src/lib/fees";

describe("deliveryFeeCents", () => {
  it("charges the flat fee on a local delivery under the threshold", () => {
    expect(deliveryFeeCents("LOCAL_DELIVERY", 599)).toBe(LOCAL_DELIVERY_FEE_CENTS);
  });

  it("charges the fee one cent under the threshold", () => {
    expect(deliveryFeeCents("LOCAL_DELIVERY", FREE_DELIVERY_MIN_SUBTOTAL_CENTS - 1)).toBe(
      LOCAL_DELIVERY_FEE_CENTS
    );
  });

  it("delivers free at exactly the threshold", () => {
    expect(deliveryFeeCents("LOCAL_DELIVERY", FREE_DELIVERY_MIN_SUBTOTAL_CENTS)).toBe(0);
  });

  it("never charges a delivery fee for pickup or shipping", () => {
    expect(deliveryFeeCents("PICKUP", 100)).toBe(0);
    expect(deliveryFeeCents("IN_STATE_SHIPPING", 100)).toBe(0);
  });
});
