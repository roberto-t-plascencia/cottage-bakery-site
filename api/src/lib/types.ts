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
  createdAt: string;
  updatedAt: string;
};

export type NewProduct = Omit<Product, "id" | "createdAt" | "updatedAt">;

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
  items: { productId: string; quantity: number; unitPriceCents: number }[];
};
