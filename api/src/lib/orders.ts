import { bakeryConfig } from "./config";
import { earliestReadyDate, formatCutoff, sameDayCutoffMinutes, type CartLine } from "./cart";
import { normalizeUsPhone } from "./phone";
import type { FulfillmentMethod } from "./types";

export type { FulfillmentMethod };

export type OrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  fulfillmentAddress?: string;
  requestedDate: Date;
  notes?: string;
  items: CartLine[];
};

export type ValidationResult =
  | { valid: true }
  | { valid: false; errors: string[] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Server-side order validation. Mirrors (and is stricter than) whatever
 * the checkout form does client-side — the client checks exist for UX,
 * this function exists so a malformed or hand-crafted API request can
 * never create bad data. Never trust the client alone (see ADR 0002).
 */
export function validateOrder(input: OrderInput): ValidationResult {
  const errors: string[] = [];

  if (!input.customerName.trim()) errors.push("Name is required.");
  if (!EMAIL_RE.test(input.customerEmail)) errors.push("A valid email is required.");
  if (!input.customerPhone.trim()) {
    errors.push("Phone number is required.");
  } else if (!normalizeUsPhone(input.customerPhone)) {
    errors.push("Enter a 10-digit phone number, like (858) 373-9363.");
  }
  if (input.items.length === 0) errors.push("Cart is empty.");
  if (input.items.some((i) => i.quantity <= 0)) {
    errors.push("Item quantities must be positive.");
  }

  const needsAddress =
    input.fulfillmentMethod === "LOCAL_DELIVERY" ||
    input.fulfillmentMethod === "IN_STATE_SHIPPING";
  if (needsAddress && !input.fulfillmentAddress?.trim()) {
    errors.push(
      input.fulfillmentMethod === "LOCAL_DELIVERY"
        ? "A delivery address is required for local delivery."
        : "A shipping address is required for shipping."
    );
  }

  // Class A Cottage Food Operations may only deliver/ship directly to
  // consumers inside California — this is a legal constraint, not a
  // business preference, so it's enforced here rather than left to the
  // honor system. See docs/adr/0002-order-fulfillment-model.md.
  if (
    input.fulfillmentMethod === "IN_STATE_SHIPPING" &&
    input.fulfillmentAddress &&
    !addressMentionsState(input.fulfillmentAddress, bakeryConfig.shippableState)
  ) {
    errors.push(
      `Shipping address must include the state (${bakeryConfig.shippableState}) — cottage food law prohibits shipping out of state.`
    );
  }

  const minDate = earliestReadyDate(input.fulfillmentMethod);
  minDate.setHours(0, 0, 0, 0);
  const requested = new Date(input.requestedDate);
  requested.setHours(0, 0, 0, 0);
  if (requested.getTime() < minDate.getTime()) {
    errors.push(
      `Requested date must be ${minDate.toDateString()} or later (same-day orders close at ${formatCutoff(sameDayCutoffMinutes(input.fulfillmentMethod))}).`
    );
  }

  return errors.length > 0 ? { valid: false, errors } : { valid: true };
}

function addressMentionsState(address: string, stateAbbr: string): boolean {
  // Deliberately loose (substring match on abbreviation or common full
  // name) rather than a full address-verification API — this is a home
  // bakery MVP, not a shipping platform. Tightening this is a documented
  // follow-up if the business scales (see ADR 0002 "Future evolution").
  const normalized = address.toUpperCase();
  return (
    normalized.includes(` ${stateAbbr} `) ||
    normalized.endsWith(stateAbbr) ||
    normalized.includes("CALIFORNIA")
  );
}
