# ADR 0006: Online payment via PayPal Checkout

**Status:** Accepted
**Date:** 2026-09-21

## Context

Today, no money moves through the site at all. `bakeryConfig` (duplicated
in `api/src/lib/config.ts` and `web/src/lib/config.ts` — see
[ADR 0004](0004-service-boundary.md) "Duplicated code, on purpose") says
payment is settled directly with the baker — cash, Venmo, or Zelle — at
pickup, delivery, or before shipping. `POST /orders` creates an order in
`PENDING` status with a `subtotal_cents` snapshot; nothing about that flow
assumes or requires payment to have happened yet.

The ask: let a buyer pay by credit card at checkout, online, without
needing a PayPal account themselves (PayPal's guest checkout covers this
— a buyer can pay by card through PayPal's flow without logging in).

Stripe was considered and is, at this project's order sizes, the cheaper
of the two (2.9% + $0.30 vs. PayPal Checkout's 3.49% + $0.49 domestic
USD, both from each provider's own current pricing pages). PayPal was
chosen anyway: the account already exists (this business already uses
PayPal for in-person point-of-sale), so there's no new business account
or verification step to go through before a sandbox app can even be
created. At this project's volume — a home bakery doing a handful of
orders a week — that setup-time saving outweighs a fee difference of a
few cents to a couple dollars a month. This tradeoff (cost vs. setup
friction) is written down explicitly rather than left implicit, in
keeping with this project's practice elsewhere (see ADR 0005's "Cost"
section).

## Decision

Use **PayPal Orders API v2** ("PayPal Checkout"), with the PayPal JS SDK
rendering the button client-side in `web/` and payment **capture done
server-side in `api/`** — never trust a client-reported "payment
succeeded" without an independent server-side capture call, since a
tampered or replayed client request could otherwise mark an unpaid order
as paid.

Flow:

1. Buyer fills out the order form in `web/` as today (customer info,
   fulfillment method, items) and reaches a "Pay with PayPal" step.
2. `web/` calls a new `api/` endpoint, `POST /orders`, same as today —
   the order is created in Postgres first, in `PENDING` status, exactly
   as it is now. This keeps order creation and payment as two separate
   steps: an order can exist before it's paid.
3. The PayPal JS SDK button (loaded client-side with the **Client ID**,
   which is not secret — PayPal's SDK is designed to be loaded with it
   exposed in the browser) creates a PayPal order for that amount, via
   a new `api/` endpoint (`POST /orders/:id/paypal-order`) that prices
   it server-side from the order's own `subtotal_cents` — never from
   anything the client sends.
4. On buyer approval in the PayPal popup/redirect, `web/` calls a new
   `api/` endpoint — `POST /orders/:id/capture-payment` — which uses the
   **Client Secret** (server-side only, in `api/`, never `web/`, same
   pattern as every other secret in this system) to call PayPal's
   capture API. This is the synchronous, buyer-facing path; the browser
   is waiting on it.
5. On a successful capture, the order's `payment_status` moves to
   `PAID` and `status` moves from `PENDING` to `CONFIRMED`. On a failed
   or declined capture, the order stays `PENDING`/`UNPAID` and `web/`
   shows the buyer an error with a retry.
6. A webhook (`POST /webhooks/paypal`) handles `PAYMENT.CAPTURE.COMPLETED`
   and `.DENIED` as a **reconciliation safety net alongside step 4, not
   a replacement for it** — every request is verified via PayPal's own
   `verify-webhook-signature` API before being trusted. `.COMPLETED`
   marks the order paid the same way step 5 does (idempotently — either
   path can run first, or both can race, without double-processing);
   `.DENIED` is a deliberate no-op today (nothing in the UI currently
   surfaces a denial that arrives out-of-band after the buyer has left
   the page). This does **not** cover a buyer who approves in the
   PayPal popup and then abandons the tab before capture is ever
   attempted — that would need `CHECKOUT.ORDER.APPROVED` instead, which
   this ADR does not add (see "Known gaps" below).

Manual payment (cash/Venmo/Zelle) **stays available alongside PayPal**,
not replaced by it — a buyer who'd rather pay at pickup can still choose
that at checkout, via a `paymentMethod` selection on the order form.

## Schema

`orders.status = 'CONFIRMED'` staying overloaded across "baker confirmed
a cash order" and "PayPal captured payment" turned out to be the wrong
call once this got implemented — payment is tracked as its own concern,
separate from fulfillment status, via a new migration
(`0003_add_payment_fields.sql`):

- `payment_method` (`'MANUAL' | 'PAYPAL'`, default `'MANUAL'`)
- `payment_status` (`'UNPAID' | 'PAID'`, default `'UNPAID'`)
- `paypal_order_id` (nullable text) — PayPal's own order id, set as soon
  as a PayPal order is created (step 3 above), not only on a successful
  capture, so an abandoned or failed payment still leaves a trail back
  to PayPal's side, and so the webhook can look an order back up by it.

A PayPal-paid order still moves through `PENDING` → `CONFIRMED` →
`READY` → `COMPLETED` like any other order; `payment_status` just
separately answers "has money already moved for this order."

## New environment variables

All live in **`api/` only**, following the existing rule that `web/`
never holds a secret capable of moving money or touching the database
(see [ADR 0004](0004-service-boundary.md), and how `SUPABASE_*`,
`ADMIN_PASSWORD`, and `JWT_SECRET` are scoped today):

- `PAYPAL_CLIENT_ID` — not secret on its own, but kept server-side so
  `api/` can hand it to `web/` via a `GET /config` response rather than
  hardcoding it into `web/`'s build; simpler to rotate.
- `PAYPAL_CLIENT_SECRET` — secret, used for the server-side create-order
  and capture calls, and to fetch the OAuth token the webhook signature
  check also uses.
- `PAYPAL_WEBHOOK_ID` — identifies which webhook subscription (configured
  in the PayPal dashboard) `verify-webhook-signature` checks incoming
  requests against. Set once the webhook is registered against a real
  deployed URL (see "Follow-ups" below) — not needed for the synchronous
  create/capture flow to work.

Sandbox values first: a PayPal **sandbox app** (created at
developer.paypal.com, under the existing PayPal business account) gives
a separate sandbox Client ID/Secret and sandbox buyer/business test
accounts, so the whole flow — create order, approve, capture, see it
land in Postgres as `CONFIRMED` — gets exercised against fake money
before any live credentials touch this codebase. Live credentials get
created the same way, in a live PayPal app, once the sandbox flow is
verified end-to-end.

## Known gaps (deliberately out of scope for this ADR)

- **Buyer approves, then abandons before capture is ever attempted**:
  neither the synchronous capture call nor the `PAYMENT.CAPTURE.*`
  webhook covers this — both only fire once a capture is attempted.
  Catching it would mean also handling `CHECKOUT.ORDER.APPROVED`. Not
  implemented; flagged here rather than silently left uncovered.
- **Refunds**: explicitly deferred until the create/capture/webhook
  flow above has been running and is "nailed down." Today there's no
  refund flow for manual payments either (the baker just hands cash
  back); PayPal's Refunds API would need its own design pass.

## Follow-ups (not blocking, tracked here)

- Apply `0003_add_payment_fields.sql` to the live Supabase project.
- Once `api/` has a real deployed URL, register a webhook subscription
  in the PayPal dashboard pointed at `POST /webhooks/paypal`, and set
  `PAYPAL_WEBHOOK_ID` from it.
- `api/`'s test script (`vitest run`) doesn't load `.env` the way
  `dev`/`start`/`db:seed` do (they all pass `--env-file=.env`) — noticed
  while verifying this feature's tests, pre-existing and unrelated to
  this ADR, but worth a follow-up so `tests/routes/admin.test.ts` and
  `tests/routes/products.test.ts` (which hit the real Supabase client
  construction, unmocked) can pass locally.

## What this replaces

Nothing existing is removed. `POST /orders` keeps working exactly as it
does today for manual-payment orders; this adds a payment step on top of
the same order record, not a new order model.
