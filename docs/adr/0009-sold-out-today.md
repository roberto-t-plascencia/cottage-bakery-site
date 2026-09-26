# ADR 0009: "Sold out today" switch

**Status:** Accepted
**Date:** 2026-09-25

## Context

With same-day ordering (see ADR 0002's lead-time note), the bakery can
run out of an item partway through the day. The owner needs a quick way
to stop same-day orders for it without taking it off the menu, and
without having to remember to turn it back on.

## Decision

- `products.sold_out_on` (a `date`, nullable) records the bakery date the
  owner marked the item sold out (migration 0005). An item is sold out
  only while `sold_out_on` is **today in America/Los_Angeles**, so it
  comes back on its own at midnight. No scheduled job, no reset step.
- It only blocks orders **for today**. Orders for tomorrow or later are
  still accepted, since those get baked in a new batch.
- The admin dashboard lists the active menu with a "Mark sold out" /
  "Back in stock" switch per item (`PATCH /products/{id}/sold-out`,
  admin only).
- `api/` rejects a new order for today that contains a sold-out item
  (`POST /orders`, 400 with the item names). That's the rule that counts.
- `web/` shows a "Sold out today · order for tomorrow" badge on the
  menu, and the checkout form starts its date picker at tomorrow when a
  sold-out item is in the cart.

## Consequences

- Storing a date instead of a boolean means no stale "sold out" flag
  can ever outlive the day it was set.
- Existing orders are not touched; marking an item sold out doesn't
  cancel anything already placed for today.
- An order started before the switch is flipped but paid after (PayPal
  step) still goes through. That's acceptable at this volume.
