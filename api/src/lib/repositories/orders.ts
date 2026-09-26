import { supabase } from "../supabase";
import type {
  NewOrderInput,
  Order,
  OrderItemWithProduct,
  OrderStatus,
  OrderWithItems,
  PaymentMethod,
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
  ingredients: string;
  net_weight: string;
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
  delivery_fee_cents: number;
  payment_method: string;
  payment_status: string;
  paypal_order_id: string | null;
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
    ingredients: row.ingredients,
    netWeight: row.net_weight,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Shared by every function below that reads a bare `orders` row (no
// items) — factored out once payment fields joined updateOrderStatus's
// and markOrderPaid's mappings, rather than duplicating the same nine
// fields in three places.
function rowToOrder(row: OrderRow): Order {
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
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.subtotal_cents + row.delivery_fee_cents,
    paymentMethod: row.payment_method as Order["paymentMethod"],
    paymentStatus: row.payment_status as Order["paymentStatus"],
    paypalOrderId: row.paypal_order_id,
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

  return { ...rowToOrder(row), items };
}

/**
 * Creates an order and its line items atomically via the
 * `create_order_with_items` Postgres function (see
 * supabase/migrations/0001_init.sql for why this has to be a database
 * function rather than two client-side inserts: PostgREST doesn't expose
 * ad-hoc multi-table transactions, and a half-written order is a corrupt
 * order, not a partial one). payment_method/payment_status aren't
 * parameters here — they default to MANUAL/UNPAID at the column level
 * (see supabase/migrations/0003_add_payment_fields.sql); a PayPal order
 * is flipped to PAYPAL right after creation via setOrderPaymentMethod,
 * rather than widening this RPC's signature for a value that's optional
 * and only sometimes different from its default.
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
    p_delivery_fee_cents: input.deliveryFeeCents,
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

// Looked up by webhooks (see routes/webhooks.ts), which only know
// PayPal's own order id, not this service's order id — a bare `orders`
// row is enough there, no need for the items join.
export async function getOrderByPayPalOrderId(paypalOrderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("paypal_order_id", paypalOrderId)
    .maybeSingle();

  if (error) throw new Error(`getOrderByPayPalOrderId: ${error.message}`);
  return data ? rowToOrder(data as OrderRow) : null;
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
  return data ? rowToOrder(data as OrderRow) : null;
}

// Set right after order creation when the buyer chose to pay by PayPal
// (see routes/orders.ts's POST /) — see createOrder's comment for why
// this is a separate call rather than a parameter on that RPC.
export async function setOrderPaymentMethod(id: string, method: PaymentMethod): Promise<void> {
  const { error } = await supabase.from("orders").update({ payment_method: method }).eq("id", id);
  if (error) throw new Error(`setOrderPaymentMethod: ${error.message}`);
}

// Set as soon as a PayPal order is created for this order (before the
// buyer has approved or paid anything) — see lib/paypal.ts's
// createPayPalOrder and docs/adr/0006-online-payment-paypal.md.
export async function setOrderPayPalOrderId(id: string, paypalOrderId: string): Promise<void> {
  const { error } = await supabase
    .from("orders")
    .update({ paypal_order_id: paypalOrderId })
    .eq("id", id);
  if (error) throw new Error(`setOrderPayPalOrderId: ${error.message}`);
}

/**
 * Marks an order paid and moves it to CONFIRMED in one update. Called
 * from two places — the synchronous capture in routes/orders.ts's
 * POST /:id/capture-payment, and the PAYMENT.CAPTURE.COMPLETED webhook
 * handler in routes/webhooks.ts — and idempotent by nature (an UPDATE to
 * the same values twice is harmless), since both paths can race for the
 * same order.
 */
export async function markOrderPaid(id: string, paypalOrderId: string): Promise<Order | null> {
  const { data, error } = await supabase
    .from("orders")
    .update({ payment_status: "PAID", status: "CONFIRMED", paypal_order_id: paypalOrderId })
    .eq("id", id)
    .select()
    .maybeSingle();

  if (error) throw new Error(`markOrderPaid: ${error.message}`);
  return data ? rowToOrder(data as OrderRow) : null;
}
