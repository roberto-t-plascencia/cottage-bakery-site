import { supabase } from "../supabase";
import { rowToProduct, type ProductRow } from "./products";
import { remainingQuantity, type Availability } from "../inventory";
import type { DayInventory, DayInventoryWithProduct } from "../types";

type DailyInventoryRow = {
  id: string;
  product_id: string;
  inventory_date: string;
  start_quantity: number;
  created_at: string;
  updated_at: string;
};

/**
 * A cancelled order gives its capacity back; every other status keeps
 * consuming it. COMPLETED especially — that loaf was baked and handed
 * over, so it must still count against the day it was ordered for, or
 * yesterday's finished orders would make yesterday look wide open again.
 */
const CAPACITY_RELEASING_STATUSES = ["CANCELLED"];

/**
 * How much of each product is already committed for one date, keyed by
 * product id. Products with nothing ordered are absent (not zero) —
 * callers fold that in with `?? 0`.
 *
 * One round trip, filtered on the embedded `orders` row: `!inner` makes
 * the join an inner join, which is what lets PostgREST accept a filter
 * on the embedded table's columns (`orders.requested_date`) rather than
 * returning every item and filtering in JS.
 */
export async function orderedQuantitiesForDate(date: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("order_items")
    .select("product_id, quantity, orders!inner(requested_date, status)")
    .eq("orders.requested_date", date)
    .not("orders.status", "in", `(${CAPACITY_RELEASING_STATUSES.join(",")})`);

  if (error) throw new Error(`orderedQuantitiesForDate: ${error.message}`);

  const ordered = new Map<string, number>();
  for (const row of data as unknown as { product_id: string; quantity: number }[]) {
    ordered.set(row.product_id, (ordered.get(row.product_id) ?? 0) + row.quantity);
  }
  return ordered;
}

/** The caps set for one date, keyed by product id. Absent = uncapped. */
export async function startQuantitiesForDate(date: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("daily_inventory")
    .select("product_id, start_quantity")
    .eq("inventory_date", date);

  if (error) throw new Error(`startQuantitiesForDate: ${error.message}`);

  return new Map(
    (data as Pick<DailyInventoryRow, "product_id" | "start_quantity">[]).map((row) => [
      row.product_id,
      row.start_quantity,
    ])
  );
}

/**
 * Availability for the given products on one date — what
 * findShortfalls (../inventory.ts) needs to accept or reject a cart.
 * Only capped products get an entry; an uncapped one is deliberately
 * absent, since that's how findShortfalls distinguishes "unlimited"
 * from "none left."
 */
export async function availabilityForDate(date: string): Promise<Map<string, Availability>> {
  const [startQuantities, ordered] = await Promise.all([
    startQuantitiesForDate(date),
    orderedQuantitiesForDate(date),
  ]);

  const availability = new Map<string, Availability>();
  for (const [productId, startQuantity] of startQuantities) {
    availability.set(productId, { startQuantity, ordered: ordered.get(productId) ?? 0 });
  }
  return availability;
}

/**
 * Every product with its cap and remaining count for one date — the
 * admin's day view. Includes uncapped products (startQuantity and
 * remaining null) so the baker sees the whole catalog for that day and
 * can set a number on anything, not just on what already has one.
 */
export async function listDayInventory(date: string): Promise<DayInventoryWithProduct[]> {
  const [products, startQuantities, ordered] = await Promise.all([
    supabase.from("products").select("*").order("category").order("name"),
    startQuantitiesForDate(date),
    orderedQuantitiesForDate(date),
  ]);

  if (products.error) throw new Error(`listDayInventory: ${products.error.message}`);

  return (products.data as ProductRow[]).map((row) => {
    const startQuantity = startQuantities.get(row.id) ?? null;
    const orderedQuantity = ordered.get(row.id) ?? 0;
    return {
      productId: row.id,
      date,
      startQuantity,
      ordered: orderedQuantity,
      remaining: remainingQuantity({ startQuantity, ordered: orderedQuantity }),
      product: rowToProduct(row),
    };
  });
}

/** One product's inventory for one date, or null if no such product. */
export async function getDayInventory(productId: string, date: string): Promise<DayInventory | null> {
  const [product, startQuantities, ordered] = await Promise.all([
    supabase.from("products").select("id").eq("id", productId).maybeSingle(),
    startQuantitiesForDate(date),
    orderedQuantitiesForDate(date),
  ]);

  if (product.error) throw new Error(`getDayInventory: ${product.error.message}`);
  if (!product.data) return null;

  const startQuantity = startQuantities.get(productId) ?? null;
  const orderedQuantity = ordered.get(productId) ?? 0;
  return {
    productId,
    date,
    startQuantity,
    ordered: orderedQuantity,
    remaining: remainingQuantity({ startQuantity, ordered: orderedQuantity }),
  };
}

/**
 * Sets (or raises, or lowers) a product's starting quantity for one
 * date. Deliberately permits a cap below what's already been ordered:
 * capacity shrinks in real life (an oven dies, a batch fails), and the
 * baker needs to stop *new* orders without the system retroactively
 * invalidating orders already accepted. Such a day reports 0 remaining —
 * see remainingQuantity's clamp — and existing orders stand.
 *
 * Upserts on the (product_id, inventory_date) unique constraint from
 * migration 0007, so "set Friday to 10" works the same whether or not
 * Friday already had a number.
 */
export async function setStartQuantity(
  productId: string,
  date: string,
  startQuantity: number
): Promise<DayInventory | null> {
  const { error } = await supabase
    .from("daily_inventory")
    .upsert(
      { product_id: productId, inventory_date: date, start_quantity: startQuantity },
      { onConflict: "product_id,inventory_date" }
    );

  // 23503 = foreign_key_violation: no product with that id. Reported as
  // "not found" rather than a 500, since that's what it means to the
  // caller.
  if (error?.code === "23503") return null;
  if (error) throw new Error(`setStartQuantity: ${error.message}`);

  return getDayInventory(productId, date);
}

/**
 * Removes a product's cap for one date, returning that date to
 * unlimited. Not the same as setting 0 — 0 means "sold out, take no
 * orders," this means "no planned limit." Deleting a row that isn't
 * there is a no-op, so this is idempotent.
 */
export async function clearStartQuantity(productId: string, date: string): Promise<DayInventory | null> {
  const { error } = await supabase
    .from("daily_inventory")
    .delete()
    .eq("product_id", productId)
    .eq("inventory_date", date);

  if (error) throw new Error(`clearStartQuantity: ${error.message}`);
  return getDayInventory(productId, date);
}
