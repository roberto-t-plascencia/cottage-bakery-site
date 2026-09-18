import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getProductById } from "@/lib/repositories/products";
import type {
  NewOrderInput,
  Order,
  OrderItem,
  OrderItemWithProduct,
  OrderStatus,
  OrderWithItems,
} from "@/lib/types";

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
};

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
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    productId: row.product_id,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
  };
}

function attachItems(order: Order): OrderWithItems {
  const itemRows = db
    .prepare(`SELECT * FROM order_items WHERE order_id = ?`)
    .all(order.id) as OrderItemRow[];

  const items: OrderItemWithProduct[] = itemRows.map((row) => {
    const item = rowToOrderItem(row);
    const product = getProductById(item.productId);
    if (!product) {
      // Shouldn't happen (products are never hard-deleted, only
      // deactivated — see ADR 0001), but fail loudly rather than silently
      // dropping a line item from someone's order history.
      throw new Error(`Order ${order.id} references missing product ${item.productId}`);
    }
    return { ...item, product };
  });

  return { ...order, items };
}

/**
 * Creates an order and its line items as one atomic unit. node:sqlite's
 * DatabaseSync doesn't expose a `transaction()` helper the way
 * better-sqlite3 does, so this wraps BEGIN/COMMIT/ROLLBACK by hand — the
 * one place in this app where that tradeoff (see db/schema.sql) is visible
 * in the code, not just the docs.
 */
export function createOrder(input: NewOrderInput): OrderWithItems {
  const orderId = randomUUID();

  db.exec("BEGIN");
  try {
    db.prepare(
      `INSERT INTO orders
        (id, customer_name, customer_email, customer_phone, fulfillment_method,
         fulfillment_address, requested_date, notes, subtotal_cents)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      orderId,
      input.customerName,
      input.customerEmail,
      input.customerPhone,
      input.fulfillmentMethod,
      input.fulfillmentAddress,
      input.requestedDate,
      input.notes,
      input.subtotalCents
    );

    const insertItem = db.prepare(
      `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price_cents)
       VALUES (?, ?, ?, ?, ?)`
    );
    for (const item of input.items) {
      insertItem.run(randomUUID(), orderId, item.productId, item.quantity, item.unitPriceCents);
    }

    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }

  return getOrderById(orderId)!;
}

export function getOrderById(id: string): OrderWithItems | null {
  const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as
    | OrderRow
    | undefined;
  if (!row) return null;
  return attachItems(rowToOrder(row));
}

export function listOrders(): OrderWithItems[] {
  const rows = db
    .prepare(`SELECT * FROM orders ORDER BY created_at DESC`)
    .all() as OrderRow[];
  return rows.map((row) => attachItems(rowToOrder(row)));
}

export function updateOrderStatus(id: string, status: OrderStatus): Order | null {
  const result = db
    .prepare(
      `UPDATE orders SET status = ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?`
    )
    .run(status, id);

  if (result.changes === 0) return null;

  const row = db.prepare(`SELECT * FROM orders WHERE id = ?`).get(id) as OrderRow;
  return rowToOrder(row);
}
