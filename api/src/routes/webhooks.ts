import { Router } from "express";
import { verifyWebhookSignature } from "../lib/paypal";
import { getOrderByPayPalOrderId, markOrderPaid } from "../lib/repositories/orders";
import { sendPaymentConfirmedEmail } from "../lib/email";

export const webhooksRouter = Router();

// POST /webhooks/paypal — called by PayPal itself, not by web/ or a
// browser. No bearer auth (PayPal has no way to send one); authenticity
// instead comes from verifying PayPal's own signature on every request
// via their verify-webhook-signature API (see ../lib/paypal.ts). Set up
// in the PayPal dashboard (the app's Webhooks section) pointing at this
// deployment's /webhooks/paypal URL, subscribed to
// PAYMENT.CAPTURE.COMPLETED and PAYMENT.CAPTURE.DENIED — see
// docs/adr/0006-online-payment-paypal.md.
//
// What this is and isn't: a reconciliation safety net alongside the
// synchronous capture in routes/orders.ts's POST /:id/capture-payment,
// not the only path to marking an order paid. The synchronous path is
// what the buyer actually waits on; this webhook exists for the case
// where PayPal's side completes a capture but the synchronous response
// back to the browser is lost (a network blip, the buyer's connection
// dropping right as it returns) — without this, that order would sit
// UNPAID forever despite having actually been paid. It does NOT cover a
// buyer who approves in the PayPal popup and then closes the tab before
// the synchronous capture is ever attempted — no capture happens in that
// case, so no PAYMENT.CAPTURE.* event fires either, only
// CHECKOUT.ORDER.APPROVED. Closing that specific gap would mean
// subscribing to CHECKOUT.ORDER.APPROVED too and capturing from the
// webhook itself instead of waiting on the browser to initiate it — a
// larger change (the buyer-facing capture call becomes a race with the
// webhook rather than the only trigger), left for a follow-up rather
// than folded in here silently.
webhooksRouter.post("/paypal", async (req, res) => {
  const authAlgo = req.header("paypal-auth-algo");
  const certUrl = req.header("paypal-cert-url");
  const transmissionId = req.header("paypal-transmission-id");
  const transmissionSig = req.header("paypal-transmission-sig");
  const transmissionTime = req.header("paypal-transmission-time");

  if (!authAlgo || !certUrl || !transmissionId || !transmissionSig || !transmissionTime) {
    res.status(400).json({ errors: ["Missing PayPal webhook signature headers."] });
    return;
  }

  const verified = await verifyWebhookSignature({
    authAlgo,
    certUrl,
    transmissionId,
    transmissionSig,
    transmissionTime,
    webhookEvent: req.body,
  });

  if (!verified) {
    res.status(400).json({ errors: ["Webhook signature verification failed."] });
    return;
  }

  const eventType = req.body?.event_type as string | undefined;
  const paypalOrderId = req.body?.resource?.supplementary_data?.related_ids?.order_id as
    | string
    | undefined;

  if (eventType === "PAYMENT.CAPTURE.COMPLETED" && paypalOrderId) {
    const order = await getOrderByPayPalOrderId(paypalOrderId);
    // Idempotent: markOrderPaid only runs if the order isn't already
    // PAID, since this can legitimately race with the synchronous
    // capture path for the same order.
    if (order && order.paymentStatus !== "PAID") {
      const updated = await markOrderPaid(order.id, paypalOrderId);
      if (updated) {
        await sendPaymentConfirmedEmail(updated);
      }
    }
  }
  // PAYMENT.CAPTURE.DENIED: intentionally a no-op. There's no separate
  // "payment failed" status to move an order to (see
  // docs/adr/0006-online-payment-paypal.md's schema discussion) — a
  // denied capture just means the order stays UNPAID, which is already
  // its state. Subscribed to anyway so this event is acknowledged
  // (200) rather than left unhandled and retried by PayPal.

  res.status(200).json({ received: true });
});
