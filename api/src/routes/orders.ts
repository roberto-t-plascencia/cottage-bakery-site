import { Router } from "express";
import { z } from "zod";
import { findProductsByIds } from "../lib/repositories/products";
import { createOrder, getOrderById, listOrders, updateOrderStatus } from "../lib/repositories/orders";
import { validateOrder } from "../lib/orders";
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
