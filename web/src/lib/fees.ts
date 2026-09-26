/**
 * Deliberately duplicated from api/src/lib/fees.ts (see that file and
 * docs/adr/0008-delivery-fee.md). This copy only *displays* the fee at
 * checkout, before the order exists; api/ computes the fee that is
 * actually stored and charged. Keep the two in sync.
 */
import type { FulfillmentOptionId } from "./config";

export const LOCAL_DELIVERY_FEE_CENTS = 300;
export const FREE_DELIVERY_MIN_SUBTOTAL_CENTS = 2500;

export function deliveryFeeCents(method: FulfillmentOptionId, subtotalCents: number): number {
  if (method !== "LOCAL_DELIVERY") return 0;
  return subtotalCents >= FREE_DELIVERY_MIN_SUBTOTAL_CENTS ? 0 : LOCAL_DELIVERY_FEE_CENTS;
}
