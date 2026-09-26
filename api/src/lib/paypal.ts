import { getEnv } from "./env";

/**
 * Minimal wrapper around PayPal's Orders API v2 and Webhooks API — just
 * the calls this service needs. No SDK dependency; PayPal's REST API is
 * plain HTTPS + JSON, and Node's built-in fetch is enough for a handful
 * of endpoints, matching this codebase's general preference for
 * hand-written code over a dependency for a small surface area (see
 * docs/adr/0001-tech-stack.md on the no-ORM decision — same instinct).
 *
 * Sandbox and live are different hosts entirely (not a query param or
 * header) — see docs/adr/0006-online-payment-paypal.md. PAYPAL_ENV picks
 * which one; anything other than exactly "live" defaults to sandbox, so
 * a missing/misspelled env var fails safe (never accidentally live).
 */
// Trimmed and lowercased, so "Live" or a value pasted with a trailing
// space still means live. Anything else is still sandbox.
const PAYPAL_MODE = process.env.PAYPAL_ENV?.trim().toLowerCase() === "live" ? "live" : "sandbox";
const PAYPAL_API_BASE =
  PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";

type AccessTokenCache = { token: string; expiresAt: number } | null;
let tokenCache: AccessTokenCache = null;

/**
 * PayPal's OAuth2 client-credentials token, cached in memory for its
 * lifetime (PayPal's tokens last ~8-9 hours) minus a safety margin — one
 * token fetch instead of one per request. A module-level cache is fine
 * here for the same reason src/lib/supabase.ts's client is a
 * module-level singleton: this process doesn't hot-reload individual
 * modules (see that file's comment).
 */
async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt > Date.now()) {
    return tokenCache.token;
  }

  const clientId = getEnv("PAYPAL_CLIENT_ID");
  const clientSecret = getEnv("PAYPAL_CLIENT_SECRET");
  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) {
    // Name the mode: a 401 here almost always means the Client ID and
    // Secret don't belong to this mode's app (live keys on sandbox or the
    // reverse), or the ID and Secret come from two different apps.
    throw new Error(
      `PayPal OAuth token request failed (${PAYPAL_MODE}, PAYPAL_ENV=${process.env.PAYPAL_ENV ?? "unset"}): ${res.status} ${await res.text()}`
    );
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };
  tokenCache = {
    token: data.access_token,
    // Refresh a minute early rather than exactly on expiry, so a request
    // that starts just before expiry doesn't race a 401 mid-flight.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

/**
 * Creates a PayPal order for the given amount. Called only after this
 * service has already created (and priced) its own order record — the
 * amount always comes from our own stored order total, never anything the
 * client sends, for the same reason POST /orders looks up prices
 * server-side (see routes/orders.ts).
 */
export async function createPayPalOrder(amountCents: number, orderId: string): Promise<string> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          // Our own order id, threaded through as PayPal's reference —
          // shows up in the PayPal dashboard and in webhook payloads,
          // useful for reconciling a PayPal transaction back to an order
          // here without relying only on the stored paypal_order_id.
          reference_id: orderId,
          amount: {
            currency_code: "USD",
            value: (amountCents / 100).toFixed(2),
          },
        },
      ],
      // We already have the delivery/shipping address (or it's a pickup),
      // so PayPal shouldn't ask for one. Without this, its card form
      // collects a shipping address of its own and can fail on it
      // (ADD_SHIPPING_ERROR) before the payment ever reaches us.
      application_context: {
        shipping_preference: "NO_SHIPPING",
        brand_name: "Mission Valley Home Bakers",
      },
    }),
  });

  if (!res.ok) {
    throw new Error(`PayPal create-order failed: ${res.status} ${await res.text()}`);
  }

  const data = (await res.json()) as { id: string };
  return data.id;
}

export type PayPalCaptureResult = {
  captured: boolean;
  paypalOrderId: string;
};

/**
 * Captures a previously-created, buyer-approved PayPal order. Returns
 * `captured: false` (rather than throwing) for a decline/failure that
 * PayPal itself reports cleanly, so the route handler can respond with
 * an ordinary 400 instead of a 500 — a declined card is an expected
 * outcome, not a server error. A genuinely unexpected failure (network,
 * a PayPal 5xx, a malformed response) still throws.
 */
export async function capturePayPalOrder(paypalOrderId: string): Promise<PayPalCaptureResult> {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
  });

  const data = (await res.json().catch(() => ({}))) as { status?: string };

  // 422 UNPROCESSABLE_ENTITY is PayPal's response for an order that
  // can't be captured (already captured, voided, or the buyer's payment
  // method was declined) — a clean, expected failure, not a server error.
  if (res.status === 422 || (res.ok && data.status && data.status !== "COMPLETED")) {
    return { captured: false, paypalOrderId };
  }

  if (!res.ok) {
    throw new Error(`PayPal capture failed: ${res.status} ${JSON.stringify(data)}`);
  }

  return { captured: data.status === "COMPLETED", paypalOrderId };
}

export type WebhookSignatureParams = {
  authAlgo: string;
  certUrl: string;
  transmissionId: string;
  transmissionSig: string;
  transmissionTime: string;
  webhookEvent: unknown;
};

/**
 * Verifies a webhook request actually came from PayPal, via PayPal's own
 * verify-webhook-signature API — unlike some providers (Stripe), PayPal
 * doesn't expect local HMAC verification against the raw body; it takes
 * the parsed event plus the signature headers and tells us whether they
 * match. PAYPAL_WEBHOOK_ID identifies *which* webhook subscription this
 * is checking against (set when the webhook is configured in the PayPal
 * dashboard — see docs/adr/0006-online-payment-paypal.md).
 */
export async function verifyWebhookSignature(params: WebhookSignatureParams): Promise<boolean> {
  const token = await getAccessToken();
  const webhookId = getEnv("PAYPAL_WEBHOOK_ID");

  const res = await fetch(`${PAYPAL_API_BASE}/v1/notifications/verify-webhook-signature`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      auth_algo: params.authAlgo,
      cert_url: params.certUrl,
      transmission_id: params.transmissionId,
      transmission_sig: params.transmissionSig,
      transmission_time: params.transmissionTime,
      webhook_id: webhookId,
      webhook_event: params.webhookEvent,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `PayPal webhook verification request failed: ${res.status} ${await res.text()}`
    );
  }

  const data = (await res.json()) as { verification_status: string };
  return data.verification_status === "SUCCESS";
}
