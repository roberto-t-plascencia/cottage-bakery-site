# ADR 0008: Local delivery fee

**Status:** Accepted
**Date:** 2026-09-25

## Context

Local delivery has been free since launch, even though the fulfillment
option's own description promised "a flat fee." Delivering a single
$5.99 loaf costs real time and gas, and PayPal's per-transaction fee
(ADR 0006) already eats a large share of a small order. The owner wants
a small delivery charge that doesn't punish larger orders.

## Decision

**Rule:** local delivery costs **$3.00** when the order's subtotal is
under **$25.00**, and is free at $25.00 and up. Pickup and in-state
shipping are unaffected. Shipping stays free for now; pricing it is a
separate decision, since postage varies by weight and distance in a way
a flat delivery fee doesn't.

**Server-side, like prices.** `api/src/lib/fees.ts` computes the fee in
`POST /orders` from the subtotal api/ itself derived from database
prices. Nothing the client sends about fees is read. The PayPal order is
created for the stored total (`subtotalCents + deliveryFeeCents`), never
a client-supplied amount, same as before.

**Stored per order.** `orders.delivery_fee_cents` (migration 0004)
records what each order was actually charged, so changing the rule later
never rewrites past orders. `totalCents` is derived when an order is read
rather than stored, so it can't drift from its parts.

**Displayed from a mirrored copy.** web/ shows the fee at checkout
before the order exists, using `web/src/lib/fees.ts`, a deliberate
duplicate of the api/ rule (specs/ENGINEERING_RULES.md "Duplicated code,
on purpose"). If the copies ever disagree, api/'s number is the one
charged, and the confirmation page, emails, and PayPal all show it.

## Rollout

Preview and Production share one Supabase database, so migration 0004 is
written to be safe while the previous api/ is still deployed: the new
column defaults to 0, and the order-creation function's new
`p_delivery_fee_cents` parameter defaults to 0, so the old code's calls
keep working. **Run the migration before deploying this code**; the new
code passes the fee to a parameter that doesn't exist until then.

## Follow-ups

- Shipping pricing (flat rate, or by weight).
- The rule's two numbers live in code on both sides. If they start
  changing often, move them to a config value api/ serves via
  `GET /config` so web/ stops needing a mirrored copy.
