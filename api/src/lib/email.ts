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

// EMAIL_FROM is set in each environment to an address on the verified
// missionvalleybakers.com domain. The fallback, resend.dev, is Resend's
// shared testing domain: it only delivers to the Resend account's own
// email address, which is fine for local development.
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

/** Customer-typed text (name, notes, address) is escaped before it goes into an email. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function send(
  to: string | string[],
  subject: string,
  html: string,
  replyTo?: string
): Promise<void> {
  const resend = getClient();
  if (!resend) {
    console.warn(`RESEND_API_KEY is not set — skipping email "${subject}" to ${to}`);
    return;
  }
  try {
    const { error } = await resend.emails.send({ from: FROM_ADDRESS, to, subject, html, replyTo });
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
          <td style="padding:4px 0;">${item.quantity} × ${escapeHtml(item.product.name)}</td>
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
      <h2 style="margin-bottom:4px;">Thanks, ${escapeHtml(order.customerName)}!</h2>
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
      <h2 style="margin-bottom:4px;">Payment received — thanks, ${escapeHtml(order.customerName)}!</h2>
      <p style="color:#444;">
        We've confirmed your PayPal payment of <strong>${formatCents(order.totalCents)}</strong>
        for order #${shortOrderId(order.id)}.
      </p>
      <p style="color:#444;">Requested date: ${formatDateOnly(order.requestedDate)}</p>
    </div>
  `;

  await send(order.customerEmail, "Payment confirmed — Mission Valley Home Bakers", html);
}

/**
 * Who gets the bakery's "new order" alert: ORDER_NOTIFICATION_EMAILS, a
 * comma-separated list, so adding a person is an env var change, not a
 * code change. Unset means no alerts (logged, like a missing API key).
 */
export function notificationRecipients(): string[] {
  return (process.env.ORDER_NOTIFICATION_EMAILS ?? "")
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

const SITE_URL = process.env.SITE_URL || "https://www.missionvalleybakers.com";

/**
 * Tells the bakery a new order needs baking. Sent when an order is
 * placed for pay-later (MANUAL) orders, and only once payment is
 * confirmed for PayPal ones, so an abandoned PayPal checkout never pings
 * anyone. Reply-To is the customer, so hitting Reply writes to them.
 */
export async function sendNewOrderNotification(order: OrderWithItems): Promise<void> {
  const recipients = notificationRecipients();
  if (recipients.length === 0) {
    console.warn(`ORDER_NOTIFICATION_EMAILS is not set — skipping new-order alert for ${order.id}`);
    return;
  }

  const payment =
    order.paymentMethod === "PAYPAL"
      ? `Paid online (PayPal) — ${formatCents(order.totalCents)}`
      : `Pay later (cash, Venmo or Zelle) — ${formatCents(order.totalCents)} to collect`;
  const address = order.fulfillmentAddress
    ? `<br/>Address: ${escapeHtml(order.fulfillmentAddress)}`
    : "";
  const notes = order.notes?.trim()
    ? `<p style="color:#444;background:#fff8e6;padding:8px 12px;border-radius:6px;"><strong>Notes:</strong> ${escapeHtml(order.notes)}</p>`
    : "";
  const phoneDigits = order.customerPhone.replace(/\D/g, "");

  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;">
      <h2 style="margin-bottom:4px;">New order from ${escapeHtml(order.customerName)}</h2>
      <p style="color:#444;margin-top:0;">
        ${FULFILLMENT_LABEL[order.fulfillmentMethod]} · ready ${formatDateOnly(order.requestedDate)}${address}
      </p>
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
      <p style="color:#444;">${payment}</p>
      ${notes}
      <p style="color:#444;">
        ${escapeHtml(order.customerEmail)}<br/>
        <a href="tel:${phoneDigits}">${escapeHtml(order.customerPhone)}</a>
      </p>
      <p><a href="${SITE_URL}/admin" style="color:#b45309;">Open the admin page</a></p>
      <p style="color:#888;font-size:13px;">Order #${shortOrderId(order.id)}</p>
    </div>
  `;

  // Preview deployments run against the test database; label their alerts
  // so a test order is never mistaken for a real one.
  const prefix = process.env.VERCEL_ENV === "preview" ? "[Preview] " : "";
  const subject = `${prefix}New order: ${order.customerName} — ${formatCents(order.totalCents)}, ${FULFILLMENT_LABEL[order.fulfillmentMethod].toLowerCase()} ${formatDateOnly(order.requestedDate)}`;

  await send(recipients, subject, html, order.customerEmail);
}
