/**
 * Hand-written domain types, standing in for what an ORM would normally
 * generate from the schema. These must be kept in sync with
 * supabase/migrations/0001_init.sql by hand — the tradeoff documented in
 * docs/adr/0001-tech-stack.md.
 *
 * These are also the shapes this service serializes onto the wire for
 * `web/` to consume — they should stay in sync with the schemas in
 * ../../../specs/openapi.yaml (both hand-kept; see
 * specs/ENGINEERING_RULES.md "Keeping the spec and the types honest").
 */

export type OrderStatus =
  | "PENDING"
  | "CONFIRMED"
  | "READY"
  | "COMPLETED"
  | "CANCELLED";

export type FulfillmentMethod = "PICKUP" | "LOCAL_DELIVERY" | "IN_STATE_SHIPPING";

// See supabase/migrations/0003_add_payment_fields.sql and
// docs/adr/0006-online-payment-paypal.md.
export type PaymentMethod = "MANUAL" | "PAYPAL";
export type PaymentStatus = "UNPAID" | "PAID";

export type Product = {
  id: string;
  slug: string;
  name: string;
  description: string;
  priceCents: number;
  category: string;
  imageUrl: string | null;
  allergens: string;
  // Cottage food label content — see api/supabase/migrations/0002_add_product_label_fields.sql.
  ingredients: string;
  netWeight: string;
  isActive: boolean;
  // Bakery date ("YYYY-MM-DD") the admin marked it sold out, or null. See
  // supabase/migrations/0005_add_sold_out_on.sql.
  soldOutOn: string | null;
  // Derived when read: soldOutOn is today's bakery date.
  soldOutToday: boolean;
  createdAt: string;
  updatedAt: string;
};

export type NewProduct = Omit<Product, "id" | "createdAt" | "updatedAt" | "soldOutOn" | "soldOutToday">;

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  unitPriceCents: number;
};

export type OrderItemWithProduct = OrderItem & { product: Product };

export type Order = {
  id: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  fulfillmentAddress: string | null;
  requestedDate: string; // ISO date string
  notes: string | null;
  status: OrderStatus;
  subtotalCents: number;
  // See docs/adr/0008-delivery-fee.md. 0 for pickup, shipping, and
  // deliveries at or above the free-delivery threshold.
  deliveryFeeCents: number;
  // subtotalCents + deliveryFeeCents: what the customer owes, and what
  // a PayPal order is created for.
  totalCents: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  // Set once a PayPal Checkout has been started for this order (see
  // api/src/lib/paypal.ts) — null for a MANUAL-payment order, or a
  // PAYPAL order for which checkout hasn't been started yet.
  paypalOrderId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderWithItems = Order & { items: OrderItemWithProduct[] };

export type NewOrderInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  fulfillmentMethod: FulfillmentMethod;
  fulfillmentAddress: string | null;
  requestedDate: string;
  notes: string | null;
  subtotalCents: number;
  deliveryFeeCents: number;
  items: { productId: string; quantity: number; unitPriceCents: number }[];
};
