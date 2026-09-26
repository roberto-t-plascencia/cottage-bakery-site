/**
 * The delivery fee rule — see docs/adr/0008-delivery-fee.md.
 *
 * api/ is the only place this is *enforced*: POST /orders computes the
 * fee here from its own server-side subtotal, stores it on the order,
 * and the PayPal amount comes from the stored total. web/ keeps a
 * mirrored copy (web/src/lib/fees.ts) purely to show the fee at
 * checkout before the order exists — deliberately duplicated, same
 * reasoning as ./cart.ts (specs/ENGINEERING_RULES.md "Duplicated code,
 * on purpose"). If the two ever disagree, api/ wins and the confirmation
 * page shows the real number.
 */
import type { FulfillmentMethod } from "./types";

export const LOCAL_DELIVERY_FEE_CENTS = 300;
export const FREE_DELIVERY_MIN_SUBTOTAL_CENTS = 2500;

export function deliveryFeeCents(method: FulfillmentMethod, subtotalCents: number): number {
  if (method !== "LOCAL_DELIVERY") return 0;
  return subtotalCents >= FREE_DELIVERY_MIN_SUBTOTAL_CENTS ? 0 : LOCAL_DELIVERY_FEE_CENTS;
}
