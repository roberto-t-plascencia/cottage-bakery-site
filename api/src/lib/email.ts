import { Resend } from "resend";
import { parseDateOnly } from "./cart";
import type { Order, OrderWithItems } from "./types";

/**
 * Customer-facing transactional email, via Resend — see
 * docs/adr/0007-order-confirmation-email.md.
 *
 * Every function here is best-effort: a Resend outage, a missing API
 * key, or any other failure is caught and logged, never thrown. Order
 * creation and payment capture are the parts of this system that matter
 * — a customer not getting a confirmation email is a real problem, but
 * it's a smaller one than an order or a payment silently failing because
 * an email provider had a bad day. Callers await these functions (so an
 * order really has been emailed-or-logged before the request completes,
 * useful on this serverless platform where nothing runs after the
 * response is sent) but never need to handle an error from them.
 */

// No verified sending domain yet (see the ADR) — resend.dev is Resend's
// shared testing domain, which only delivers to the Resend account's own
// email address. Swap EMAIL_FROM once a real domain is verified in
// Resend; nothing else here needs to change.
const FROM_ADDRESS = process.env.EMAIL_FROM || "Mission Valley Home Bakers <onboarding@resend.dev>";

let cachedClient: Resend | null = null;

function getClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  if (!cachedClient) cachedClient = new Resend(apiKey);
  return cachedClient;
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

// Mirrors web/src/lib/cart.ts's formatDateOnly (see api/src/lib/cart.ts's
// file comment on why this is hand-duplicated rather than shared) — same
// local-midnight parsing to avoid the UTC-parsing day-shift trap.
function formatDateOnly(isoDateOnly: string): string {
  return parseDateOnly(isoDateOnly).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function shortOrderId(orderId: string): string {
  return orderId.slice(0, 8);
}

async function send(to: string, subject: string, html: string): Promise<void> {
  const resend = getClient();
  if (!resend) {
    console.warn(`RESEND_API_KEY is not set — skipping email "${subject}" to ${to}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html });
    if (error) {
      console.error(`Resend rejected email "${subject}" to ${to}:`, error);
    }
  } catch (err) {
    console.error(`Failed to send email "${subject}" to ${to}:`, err);
  }
}

function itemsRowsHtml(order: OrderWithItems): string {
  return order.items
    .map(
      (item) => `
        <tr>
          <td style="padding:4px 0;">${item.quantity} × ${item.product.name}</td>
          <td style="padding:4px 0;text-align:right;">${formatCents(item.unitPriceCents * item.quantity)}</td>
        </tr>`
    )
    .join("");
}

// Only local-delivery orders get a delivery line at all; one that
// qualified for free delivery says so, rather than silently omitting
// the line and leaving the customer wondering whether they were charged.
function deliveryFeeRowHtml(order: Order): string {
  if (order.fulfillmentMethod !== "LOCAL_DELIVERY") return "";
  const value = order.deliveryFeeCents === 0 ? "Free" : formatCents(order.deliveryFeeCents);
  return `
        <tr>
          <td style="padding-top:4px;">Delivery</td>
          <td style="padding-top:4px;text-align:right;">${value}</td>
        </tr>`;
}

const FULFILLMENT_LABEL: Record<OrderWithItems["fulfillmentMethod"], string> = {
  PICKUP: "Pickup",
  LOCAL_DELIVERY: "Local delivery",
  IN_STATE_SHIPPING: "Shipping (within California)",
};

/**
 * Sent right after an order is created — every order, regardless of
 * payment method, since this is the "we got your request" receipt (see
 * the ADR's "Which events" section for why this fires for MANUAL orders
 * too, not just PayPal ones).
 */
export async function sendOrderReceivedEmail(order: OrderWithItems): Promise<void> {
  const paymentNote =
    order.paymentMethod === "PAYPAL"
      ? "You'll get a separate email once your PayPal payment is confirmed."
      : "Payment is settled directly with the baker — cash, Venmo, or Zelle — at pickup, delivery, or before shipping.";

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="margin-bottom:4px;">Thanks, ${order.customerName}!</h2>
      <p style="color:#444;">Your order request from Mission Valley Home Bakers has been received.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;border-top:1px solid #ddd;border-bottom:1px solid #ddd;padding:8px 0;">
        ${itemsRowsHtml(order)}
        <tr>
          <td style="padding-top:8px;">Subtotal</td>
          <td style="padding-top:8px;text-align:right;">${formatCents(order.subtotalCents)}</td>
        </tr>
        ${deliveryFeeRowHtml(order)}
        <tr>
          <td style="padding-top:4px;font-weight:bold;">Total</td>
          <td style="padding-top:4px;font-weight:bold;text-align:right;">${formatCents(order.totalCents)}</td>
        </tr>
      </table>
      <p style="color:#444;">
        Fulfillment: ${FULFILLMENT_LABEL[order.fulfillmentMethod]}<br/>
        Requested date: ${formatDateOnly(order.requestedDate)}
      </p>
      <p style="color:#444;">${paymentNote}</p>
      <p style="color:#888;font-size:13px;">Order #${shortOrderId(order.id)}</p>
    </div>
  `;

  await send(order.customerEmail, "Your Mission Valley Home Bakers order was received", html);
}

/**
 * Sent once a PayPal payment actually captures — from both the
 * synchronous capture route and the webhook reconciliation path (see
 * routes/orders.ts and routes/webhooks.ts), each of which already
 * guards against calling this twice for the same order. MANUAL-payment
 * orders never reach this; they only ever get the "received" email
 * above.
 */
export async function sendPaymentConfirmedEmail(order: Order): Promise<void> {
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="margin-bottom:4px;">Payment received — thanks, ${order.customerName}!</h2>
      <p style="color:#444;">
        We've confirmed your PayPal payment of <strong>${formatCents(order.totalCents)}</strong>
        for order #${shortOrderId(order.id)}.
      </p>
      <p style="color:#444;">Requested date: ${formatDateOnly(order.requestedDate)}</p>
    </div>
  `;

  await send(order.customerEmail, "Payment confirmed — Mission Valley Home Bakers", html);
}
