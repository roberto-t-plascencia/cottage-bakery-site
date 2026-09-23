# ADR 0007: Order confirmation email via Resend

**Status:** Accepted
**Date:** 2026-09-22

## Context

Once [ADR 0006](0006-online-payment-paypal.md) shipped, a buyer can
complete an entire order — including paying for it — without the bakery
or the buyer ever getting anything outside the confirmation page itself.
There's no record left in the buyer's inbox, and no notification at all
if they close the tab right after ordering. The ask: send the buyer a
confirmation email, automatically, at the meaningful points in an
order's life.

SMS was considered and set aside for now — it adds a second provider,
carrier costs, and (in the US) opt-in/compliance requirements (10DLC
registration) that email doesn't have, for a home bakery that doesn't
yet have volume to justify that setup cost. Email covers the same need
today; SMS is a later option if it turns out buyers want it.

**Resend** was chosen over other transactional-email providers because
the business already has an account and has used it before — same
reasoning as PayPal in ADR 0006 (an account that already exists beats a
cheaper or more full-featured option that needs new signup and
verification steps first).

## Decision

A new module, `api/src/lib/email.ts`, wraps the `resend` SDK behind two
functions — `sendOrderReceivedEmail` and `sendPaymentConfirmedEmail` —
and every email this system sends goes through it. `web/` never talks to
Resend directly; email is exclusively an `api/`-side concern, same
service-boundary reasoning as every secret-holding integration so far
(see [ADR 0004](0004-service-boundary.md)).

**Best-effort, not blocking:** every function in `email.ts` catches its
own errors (a Resend outage, a rejected send, a missing API key) and
logs rather than throws. An order being created or a payment being
captured is what actually matters to this system; a customer not
getting a confirmation email is a real problem, but a smaller one than
an order or payment silently failing because an email provider had a
bad day. Callers `await` these functions anyway — not fire-and-forget —
because on this project's serverless deployment target ([ADR 0005](0005-deployment-targets.md))
nothing runs after the HTTP response is sent, so a fire-and-forget call
would frequently be killed mid-flight before it ever reached Resend.
Awaiting a function that can't throw costs nothing and guarantees the
send is actually attempted.

**Missing API key is not an error:** if `RESEND_API_KEY` is unset,
`email.ts` logs a warning and skips the send, rather than throwing the
way `getEnv()` (`api/src/lib/env.ts`) does for other required
configuration. This is deliberate — unlike Supabase or the admin
password, nothing else in this system depends on email having been
sent, so treating it as required would turn a missing *optional*
integration into a hard outage for order creation and payment capture.

## Which events trigger an email

Two emails, two triggers, both already covered by `api/src/routes/orders.ts`
and `api/src/routes/webhooks.ts`:

- **`sendOrderReceivedEmail`** — fires once, right after `POST /orders`
  creates the order, **for every order regardless of payment method**.
  This is deliberate: a MANUAL-payment order (cash/Venmo/Zelle at
  pickup, delivery, or before shipping) is just as much a real
  commitment as a PayPal order, and its buyer deserves the same "we got
  your request" receipt — the email's payment note simply reads
  differently depending on `paymentMethod` (a PayPal buyer is told a
  second email is coming once payment clears; a MANUAL buyer is told
  how payment gets settled).
- **`sendPaymentConfirmedEmail`** — fires once payment actually
  captures, for PayPal orders only. MANUAL orders never reach this;
  there's no separate "payment confirmed" moment for them to report on.
  It's called from **both** places `markOrderPaid` is called from ADR
  0006's flow — the synchronous `POST /:id/capture-payment` route and
  the `PAYMENT.CAPTURE.COMPLETED` webhook handler — reusing the exact
  idempotency guards already in place at each call site (`paymentStatus
  === "PAID"` short-circuit in the route; `paymentStatus !== "PAID"`
  guard in the webhook) so a race between the two paths, which ADR 0006
  already accounts for, can't send the email twice.

## New environment variables

Both live in `api/` only, both optional:

- `RESEND_API_KEY` — secret. Unset means email sending is silently
  skipped (see above), not a startup failure.
- `EMAIL_FROM` — the sender address. Defaults to
  `Mission Valley Home Bakers <onboarding@resend.dev>` when unset.

## Known gap: no verified sending domain yet

`onboarding@resend.dev` is Resend's shared testing sender, which
**only delivers to the Resend account's own email address** — not to
arbitrary customers. That's an acceptable starting point (it proves the
integration works end-to-end against the account owner's own inbox) but
it does not yet actually notify real buyers. Verifying a real sending
domain (adding the DNS records Resend's dashboard provides, then
setting `EMAIL_FROM` to an address on that domain) is a follow-up, not
part of this decision — this project doesn't have its own domain set up
yet at all (see [ADR 0005](0005-deployment-targets.md)'s deployment
targets, which are still on `*.vercel.app`).

## Follow-ups (not blocking, tracked here)

- Verify a real sending domain in Resend once this project has its own
  domain, and switch `EMAIL_FROM` over — no code change needed beyond
  the environment variable.
- Add `RESEND_API_KEY` to Vercel (Preview, then Production) for the
  `cottage-bakery-api` project.
- SMS notifications, if it turns out buyers want them — deliberately
  out of scope here (see "Context" above).
- The `CHECKOUT.ORDER.APPROVED` gap already documented in ADR 0006 (a
  buyer who approves in the PayPal popup and abandons the tab before
  capture) means that order also never gets a `sendPaymentConfirmedEmail`
  — same root cause, not a new gap introduced by this ADR.

## What this replaces

Nothing existing is removed or changed in behavior; this adds a
notification step alongside order creation and payment capture, neither
of which is affected if email sending fails.
