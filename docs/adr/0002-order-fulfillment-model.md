# ADR 0002: Order model — request-to-fulfill, not online checkout

**Status:** Accepted
**Date:** 2026-09-18

> **Note (post-[ADR 0004](0004-service-boundary.md)):** the order
> validation this ADR describes (`src/lib/orders.ts`,
> `addressMentionsState`, the lead-time check) now lives in
> `api/src/lib/orders.ts`; the route that used to be
> `src/app/api/orders/route.ts` is now `api/src/routes/orders.ts`, with
> `web/src/app/api/orders/route.ts` as a thin proxy in front of it. The
> business/legal reasoning below — request-to-fulfill, not checkout, and
> why — is unchanged; it just moved with the code that enforces it.

## Context

California's Cottage Food Program lets a Class A Cottage Food Operation
(CFO) sell "direct to consumer" — in person, by phone, or online — via
pickup, local delivery, or shipping, as long as every sale ends with a
California consumer (no out-of-state shipping, no sales through a
third-party retailer). Online ordering itself is explicitly allowed; this
isn't a legal constraint on building an ordering flow. Sources: California
cottage food guidance on Class A direct sales channels and the "must end
with a California consumer" rule for both Class A and B operations.

The open question this ADR answers isn't *whether* to take orders online —
it's *what happens when the customer submits the form*: does the app take
payment itself, or does it hand off to the baker?

## Decision

The order form is a **request**, not a checkout. Submitting it creates an
`Order` row with status `PENDING` and a computed subtotal; no payment is
collected in-app. Payment (cash, Venmo, Zelle, whatever the baker and
customer agree on) is arranged directly once the baker confirms the order
by phone/email/text. The confirmation page and email-adjacent copy say
this explicitly so it's never ambiguous to the customer.

## Why not integrate real payment processing (e.g. Stripe) now

Not a legal requirement — a scope call. Three reasons:

1. **A single-operator home bakery doesn't have fixed availability.** A
   pastry case reserves nothing; a specific baking slot is finite. Taking
   payment before the baker confirms they can actually produce the order
   by the requested date risks needing refunds, which is worse UX than
   confirming first and charging second (or never charging in-app at all).
2. **Payment processing brings real obligations** — PCI scope (even with
   Stripe handling card data, there's webhook handling, refund flows, and
   reconciliation to build correctly), a Stripe account tied to the
   business's actual legal/tax setup, and a meaningfully larger surface
   area to test and secure. None of that is justified yet by order volume
   for a business that just got its permit.
3. **It's not needed for the thing this project is actually optimizing
   for right now**: a real, usable ordering flow for the bakery, built the
   way a thoughtful engineer scopes an MVP — the right amount for today,
   with an explicit seam for tomorrow rather than either overbuilding now
   or hand-waving payment forever.

## The seam for later

If/when in-app payment is worth building: `Order.status` already has a
`CONFIRMED` state that's a natural trigger point ("baker confirmed →
send a payment link"), `Order.subtotalCents` is already computed
server-side from trusted prices, and the order creation path
(`src/app/api/orders/route.ts`) already never trusts client-submitted
prices — the exact invariant a real payment integration needs. Adding
Stripe later means adding a `paymentStatus` field and a webhook handler,
not rearchitecting the order model.

## Enforcing the legal constraint in code, not just in the UI copy

Two rules are encoded as validation, not just documentation, because
"the form usually stops you" isn't the same guarantee as "the server
refuses it":

- `IN_STATE_SHIPPING` requires the address to mention California (see
  `addressMentionsState` in `src/lib/orders.ts`). This is deliberately a
  loose substring check, not a real address-verification API call — see
  the code comment for why, and what to tighten if the business scales
  past hand-checking every order before confirming it.
- ~~Every order requires at least `MIN_LEAD_TIME_DAYS` of lead time.~~
  *Superseded 2026-09-25:* same-day orders are allowed until a
  per-method cutoff (8 PM for pickup and shipping, 9:30 PM for local
  delivery, America/Los_Angeles), after which the earliest ready date is
  tomorrow (`sameDayCutoffMinutes` in `src/lib/cart.ts`); running out of
  a product for the day is handled per product instead.
  The ready-date rule isn't a legal requirement — it's an operational one, kept
  here because the checkout form and the server-side validator both need
  the same definition of "earliest possible ready date," and duplicating
  the constant in two places is how they drift apart.

## What to revisit before this scales

The disclosure copy in `src/app/about/page.tsx` is a placeholder — exact
required cottage-food disclosure language should be confirmed with the
operator's county Environmental Health department before this goes live,
not assumed from general guidance. This is flagged in the page itself.
