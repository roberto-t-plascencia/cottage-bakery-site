/**
 * Hand-written domain types, standing in for what an ORM would normally
 * generate from the schema. These must be kept in sync with
 * supabase/migrations/0001_init.sql by hand — the tradeoff documented in
 * docs/adr/0001-tech-stack.md.
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
