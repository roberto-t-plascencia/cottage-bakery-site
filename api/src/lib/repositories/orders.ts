import { supabase } from "../supabase";
import type {
  NewOrderInput,
  Order,
  OrderItemWithProduct,
  OrderStatus,
  OrderWithItems,
} from "../types";

type ProductRow = {
  id: string;
  slug: string;
  name: string;
  description: string;
  price_cents: number;
  category: string;
  image_url: string | null;
  allergens: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type OrderRow = {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  fulfillment_method: string;
  fulfillment_address: string | null;
  requested_date: string;
  notes: string | null;
  status: string;
  subtotal_cents: number;
  created_at: string;
  updated_at: string;
};

type OrderItemRow = {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  unit_price_cents: number;
  product: ProductRow;
};

type OrderWithItemsRow = OrderRow & { items: OrderItemRow[] };

// Every read of an order also fetches its line items and each item's
// product in one round trip via Supabase's embedded-resource syntax,
// rather than N+1 separate queries — order_items.order_id and
// order_items.product_id are real foreign keys (see
// supabase/migrations/0001_init.sql), which is what makes this join
// inferrable from the schema instead of needing an explicit `!inner`
// hint.
const ORDER_WITH_ITEMS_SELECT = `
  *,
  items:order_items (
    id, order_id, product_id, quantity, unit_price_cents,
    product:products (*)
  )
`;

function rowToProduct(row: ProductRow) {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    priceCents: row.price_cents,
    category: row.category,
    imageUrl: row.image_url,
    allergens: row.allergens,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToOrderWithItems(row: OrderWithItemsRow): OrderWithItems {
  const items: OrderItemWithProduct[] = row.items.map((item) => ({
    id: item.id,
    orderId: item.order_id,
    productId: item.product_id,
    quantity: item.quantity,
    unitPriceCents: item.unit_price_cents,
    product: rowToProduct(item.product),
  }));

  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    fulfillmentMethod: row.fulfillment_method as Order["fulfillmentMethod"],
    fulfillmentAddress: row.fulfillment_address,
    requestedDate: row.requested_date,
    notes: row.notes,
    status: row.status as OrderStatus,
    subtotalCents: row.subtotal_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

/**
 * Creates an order and its line items atomically via the
 * `create_order_with_items` Postgres function (see
 * supabase/migrations/0001_init.sql for why this has to be a database
 * function rather than two client-side inserts: PostgREST doesn't expose
 * ad-hoc multi-table transactions, and a half-written order is a corrupt
 * order, not a partial one).
 */
export async function createOrder(input: NewOrderInput): Promise<OrderWithItems> {
  const { data: orderId, error } = await supabase.rpc("create_order_with_items", {
    p_customer_name: input.customerName,
    p_customer_email: input.customerEmail,
    p_customer_phone: input.customerPhone,
    p_fulfillment_method: input.fulfillmentMethod,
    p_fulfillment_address: input.fulfillmentAddress,
    p_requested_date: input.requestedDate,
    p_notes: input.notes,
    p_subtotal_cents: input.subtotalCents,
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      quantity: item.quantity,
      unit_price_cents: item.unitPriceCents,
    })),
  });

  if (error) throw new Error(`createOrder: ${error.message}`);

  const order = await getOrderById(orderId as string);
  if (!order) {
    // Would mean the RPC committed but this read failed — treat as a hard
    // error rather than returning something callers might treat as "no
    // such order," since the order does exist.
    throw new Error(`createOrder: order ${orderId} was created but could not be read back`);
  }
  return order;
}

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_WITH_ITEMS_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`getOrderById: ${error.message}`);
  return data ? rowToOrderWithItems(data as unknown as OrderWithItemsRow) : null;
}

export async function listOrders(): Promise<OrderWithItems[]> {
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_WITH_ITEMS_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(`listOrders: ${error.message}`);
  return (data as unknown as OrderWithItemsRow[]).map(rowToOrderWithItems);
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .update({ status })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`updateOrderStatus: ${error.message}`);
  if (!data) return null;

  const row = data as OrderRow;
  return {
    id: row.id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    fulfillmentMethod: row.fulfillment_method as Order["fulfillmentMethod"],
    fulfillmentAddress: row.fulfillment_address,
    requestedDate: row.requested_date,
    notes: row.notes,
    status: row.status as OrderStatus,
    subtotalCents: row.subtotal_cents,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
