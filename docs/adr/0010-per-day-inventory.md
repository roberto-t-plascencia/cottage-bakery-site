# ADR 0010: Per-day starting quantities

**Status:** Accepted
**Date:** 2026-11-10

## Context

ADR 0009 gave the bakery a one-tap "sold out today" switch. That covers
reacting to a day that's already gone wrong, but not planning one: the
owner wants to say *"tomorrow we start with 10 sourdough"* and have the
site count down as orders arrive, stopping when the day is full. The
number also has to move — capacity grows as the operation ramps up, and
occasionally shrinks when something goes wrong in the kitchen.

Customers could already order for future dates (ADR 0002's lead-time
rule), so the demand side of this existed; what was missing was any
notion of supply.

Separately, the admin dashboard had become unusable for a different
reason: it rendered **every order ever placed** in one table, newest
first, with the catalog stacked above it on the same page. The question
the owner actually has each morning — "what am I baking today?" — was
buried in historical rows.

## Decision

### Capacity

- A new `daily_inventory` table (migration 0007) holds one row per
  `(product, date)` with a `start_quantity`. **No row means unlimited**,
  not zero. Every date nobody has planned keeps behaving exactly as it
  did before this feature existed, and forgetting to set numbers can
  never silently close the shop.
- `0` is a real, distinct value meaning "take no orders for that date."
  Clearing a cap (back to unlimited) is `startQuantity: null`, a
  different operation from setting `0`. The admin UI surfaces this as
  "leave the box blank" vs "type 0".
- **Remaining is derived, never stored**: `start_quantity` minus the
  quantities already ordered for that date, with cancelled orders
  excluded, clamped at 0. A stored counter would be a second source of
  truth for a fact the orders already determine, and the two would drift
  the first time an order was cancelled or edited.
- `remaining` is `null` on an uncapped date, not `Infinity` or `-1`, so
  a caller that forgets the unlimited case gets a type error rather than
  a wrong comparison against 0.
- `api/` rejects a new order that exceeds the requested date's remaining
  count (`POST /orders`, 400 naming each short item and what's actually
  left). That enforcement is the point of the feature — a count that
  only informs the admin wouldn't prevent overselling.
- Lowering a cap below what's already been ordered is **allowed**. Real
  capacity shrinks, and the owner needs to stop new orders without the
  system retroactively invalidating orders already accepted. Such a day
  reports 0 remaining; existing orders stand.
- The ADR 0009 switch **stays** alongthis. The two answer different
  questions ("what do we plan to have" vs "the tray just hit the floor")
  and either one can sell an item out. Collapsing them into one concept
  would have made "today's batch is gone" a typing exercise instead of
  one tap.

### Admin dashboard

- The page is split into two tabs, **Orders** and **Catalog**
  (`?tab=`), instead of one long scroll.
- Orders are bucketed by the date the customer wants them:
  **Today · Tomorrow · Upcoming · Past due · Archive · All**
  (`?orders=`). Every order falls into exactly one bucket, so the
  buckets partition the list rather than overlapping — which is what
  makes it safe to default to a narrow view.
- **Past due** exists specifically so narrowing the view can't lose
  anything: an order whose date has passed while still open shows up
  there, highlighted, rather than disappearing into history.
- **Nothing is ever deleted.** "Don't show me all the orders" is solved
  by windowing the view, not by destroying records — the sales history
  matters for taxes and for any customer who calls back about an old
  order. There is no bulk-delete endpoint.
- Each date group shows a one-line bake list (`3× Sourdough, 1×
  Cookies`), summed across that day's orders with cancelled ones
  excluded.
- All of this state lives in the URL, so the page stays a Server
  Component that re-reads live data on every change, and a view can be
  bookmarked.

## Consequences

- **Known limitation — the capacity check is not atomic.** `POST /orders`
  reads availability and then inserts, with no lock between. Two orders
  placed in the same instant can both pass the check and oversell the
  last item by one. The alternative was moving the check inside the
  `create_order_with_items` Postgres function so it runs in the insert's
  transaction; at this bakery's volume (single-digit orders a day) that
  complexity buys very little, and overselling by one is recoverable by
  a phone call. Revisit if order volume ever makes a collision likely.
- **The customer-facing menu does not yet show per-date counts.** A
  customer can still add 12 loaves for a date with 3 left and only find
  out when they submit, where they get a clear message naming the real
  remainder. Surfacing availability on the menu and order form means
  re-reading it whenever the date picker changes, which is a larger
  change to the checkout flow than this one — deliberately left as a
  follow-up rather than half-built. The ADR 0009 "sold out today" badge
  still appears as it did.
- Remaining counts cost two queries per read (the caps, and the ordered
  quantities for that date). `orders.requested_date` gained an index in
  migration 0007, which it should have had regardless now that the
  dashboard filters on it.
- `GET /orders` still returns every order and the dashboard buckets them
  in memory. That's fine for a home bakery's history and keeps the
  bucket counts honest without six separate queries; if the table ever
  grows past a few thousand rows, this is the thing to paginate.
