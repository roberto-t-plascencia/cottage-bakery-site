import { Router } from "express";
import { z } from "zod";
import { findProductsByIds } from "../lib/repositories/products";
import {
  createOrder,
  getOrderById,
  listOrders,
  markOrderPaid,
  setOrderPayPalOrderId,
  setOrderPaymentMethod,
  updateOrderStatus,
} from "../lib/repositories/orders";
import { capturePayPalOrder, createPayPalOrder } from "../lib/paypal";
import { validateOrder } from "../lib/orders";
import { sendOrderReceivedEmail, sendPaymentConfirmedEmail } from "../lib/email";
import { parseDateOnly } from "../lib/cart";
import { requireAdmin } from "../middleware/requireAdmin";
import type { OrderStatus } from "../lib/types";

export const ordersRouter = Router();

// Express 5 types a route param as `string | string[]` (to account for
// repeated-segment routes elsewhere in the framework) even though none
// of this router's routes can actually produce an array here — this
// narrows it once instead of asserting at every call site.
function paramId(value: string | string[]): string {
  return Array.isArray(value) ? value[0] : value;
}

const VALID_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "READY", "COMPLETED", "CANCELLED"];

// Shape-level validation only (right types, non-empty items) — the
// business/legal rules (address required for shipping, lead time, CA-only
// shipping) live in validateOrder (../lib/orders.ts) and are unit-tested
// there. This schema's job is just "reject garbage before it gets that
// far," per specs/ENGINEERING_RULES.md "Where validation lives."
const CreateOrderSchema = z.object({
  customerName: z.string(),
  customerEmail: z.string(),
  customerPhone: z.string(),
  fulfillmentMethod: z.enum(["PICKUP", "LOCAL_DELIVERY", "IN_STATE_SHIPPING"]),
  fulfillmentAddress: z.string().optional(),
  requestedDate: z.string(),
  notes: z.string().optional(),
  items: z
    .array(z.object({ productId: z.string(), quantity: z.number() }))
    .min(1, "Cart is empty."),
  // Defaults to MANUAL (cash/Venmo/Zelle at pickup/delivery) when
  // omitted — see docs/adr/0006-online-payment-paypal.md. Not passed to
  // createOrder's RPC; see repositories/orders.ts's createOrder comment.
  paymentMethod: z.enum(["MANUAL", "PAYPAL"]).optional(),
});

// POST /orders — public. The checkout form on web/ hits this indirectly,
// via web/'s own /api/orders route acting as a thin proxy (see
// web/src/app/api/orders/route.ts) — the browser never calls this
// service directly.
ordersRouter.post("/", async (req, res) => {
  const parsed = CreateOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: parsed.error.issues.map((i) => i.message) });
    return;
  }
  const body = parsed.data;

  // Prices are looked up server-side from the database — never trusted
  // from the request body. Without this, a modified client request could
  // submit arbitrary prices; this is the one line standing between
  // "checkout form" and "anyone can order a $0.01 wedding cake."
  const productIds = body.items.map((i) => i.productId);
  const products = await findProductsByIds(productIds);
  const productById = new Map(products.map((p) => [p.id, p]));

  const missing = productIds.filter((id) => !productById.has(id));
  if (missing.length > 0) {
    res
      .status(400)
      .json({ errors: ["One or more items are no longer available. Please refresh the menu."] });
    return;
  }

  const cartLines = body.items.map((item) => {
    const product = productById.get(item.productId)!;
    return {
      productId: product.id,
      name: product.name,
      unitPriceCents: product.priceCents,
      quantity: item.quantity,
    };
  });

  const requestedDate = parseDateOnly(body.requestedDate);
  if (Number.isNaN(requestedDate.getTime())) {
    res.status(400).json({ errors: ["Requested date is invalid."] });
    return;
  }

  const validation = validateOrder({
    customerName: body.customerName,
    customerEmail: body.customerEmail,
    customerPhone: body.customerPhone,
    fulfillmentMethod: body.fulfillmentMethod,
    fulfillmentAddress: body.fulfillmentAddress,
    requestedDate,
    notes: body.notes,
    items: cartLines,
  });

  if (!validation.valid) {
    res.status(400).json({ errors: validation.errors });
    return;
  }

  const subtotalCents = cartLines.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);

  const order = await createOrder({
    customerName: body.customerName,
    customerEmail: body.customerEmail,
    customerPhone: body.customerPhone,
    fulfillmentMethod: body.fulfillmentMethod,
    fulfillmentAddress: body.fulfillmentAddress || null,
    // The client's original "YYYY-MM-DD" string, passed straight through
    // rather than re-derived from the `requestedDate` Date object — see
    // ../lib/cart.ts's comment on parseDateOnly for the off-by-one-day
    // trap that avoids.
    requestedDate: body.requestedDate,
    notes: body.notes || null,
    subtotalCents,
    items: cartLines.map((line) => ({
      productId: line.productId,
      quantity: line.quantity,
      unitPriceCents: line.unitPriceCents,
    })),
  });

  if (body.paymentMethod === "PAYPAL") {
    await setOrderPaymentMethod(order.id, "PAYPAL");
    order.paymentMethod = "PAYPAL";
  }

  // Fires for every order, MANUAL or PAYPAL — see lib/email.ts's
  // sendOrderReceivedEmail comment. Awaited (not fire-and-forget) since
  // nothing runs after this handler's response on this serverless
  // platform, but never throws — see that file's top comment.
  await sendOrderReceivedEmail(order);

  res.status(201).json({ order });
});

// GET /orders — admin only. web/'s /admin dashboard Server Component
// calls this, forwarding the admin's bearer token from its own cookie.
ordersRouter.get("/", requireAdmin, async (_req, res) => {
  const orders = await listOrders();
  res.json({ orders });
});

// GET /orders/:id — public (a customer viewing their own confirmation
// page has no account to authenticate; the order id itself — a uuid —
// is the only thing gating access, same as the pre-split app).
ordersRouter.get("/:id", async (req, res) => {
  const order = await getOrderById(paramId(req.params.id));
  if (!order) {
    res.status(404).json({ errors: ["Order not found."] });
    return;
  }
  res.json({ order });
});

const UpdateStatusSchema = z.object({
  status: z.enum(VALID_STATUSES as [OrderStatus, ...OrderStatus[]]),
});

// PATCH /orders/:id/status — admin only.
ordersRouter.patch("/:id/status", requireAdmin, async (req, res) => {
  const parsed = UpdateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: [`Status must be one of: ${VALID_STATUSES.join(", ")}`] });
    return;
  }

  const order = await updateOrderStatus(paramId(req.params.id), parsed.data.status);
  if (!order) {
    res.status(404).json({ errors: ["Order not found."] });
    return;
  }
  res.json({ order });
});

// POST /orders/:id/paypal-order — public, same trust model as
// GET /orders/:id (the uuid order id is the access control). Creates a
// PayPal order sized to *this* order's own subtotal_cents — the amount
// is never taken from the request, so a tampered client can't create a
// PayPal order for less than what's actually owed. See
// docs/adr/0006-online-payment-paypal.md.
ordersRouter.post("/:id/paypal-order", async (req, res) => {
  const order = await getOrderById(paramId(req.params.id));
  if (!order) {
    res.status(404).json({ errors: ["Order not found."] });
    return;
  }
  if (order.paymentStatus === "PAID") {
    res.status(400).json({ errors: ["This order has already been paid."] });
    return;
  }

  const paypalOrderId = await createPayPalOrder(order.subtotalCents, order.id);
  await setOrderPayPalOrderId(order.id, paypalOrderId);
  res.json({ paypalOrderId });
});

const CapturePaymentSchema = z.object({
  paypalOrderId: z.string(),
});

// POST /orders/:id/capture-payment — public, same trust model. This is
// the synchronous, buyer-facing capture path (the browser is waiting on
// it); routes/webhooks.ts's PAYMENT.CAPTURE.COMPLETED handler is a
// reconciliation safety net alongside it, not a replacement for it — see
// that file's comment and docs/adr/0006-online-payment-paypal.md for the
// gap neither one covers.
ordersRouter.post("/:id/capture-payment", async (req, res) => {
  const parsed = CapturePaymentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ errors: ["paypalOrderId is required."] });
    return;
  }

  const order = await getOrderById(paramId(req.params.id));
  if (!order) {
    res.status(404).json({ errors: ["Order not found."] });
    return;
  }
  if (order.paypalOrderId !== parsed.data.paypalOrderId) {
    res.status(400).json({ errors: ["This PayPal order does not match this order."] });
    return;
  }
  if (order.paymentStatus === "PAID") {
    // Idempotent: a retried request (e.g. a flaky connection right after
    // the first one actually succeeded) gets the same success response,
    // not a confusing error about an order that's already fine.
    res.json({ order });
    return;
  }

  const result = await capturePayPalOrder(parsed.data.paypalOrderId);
  if (!result.captured) {
    res.status(400).json({ errors: ["Payment was not completed. Please try again."] });
    return;
  }

  const updated = await markOrderPaid(order.id, result.paypalOrderId);
  if (updated) {
    await sendPaymentConfirmedEmail(updated);
  }
  res.json({ order: updated });
});
