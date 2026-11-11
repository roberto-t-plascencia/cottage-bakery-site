/**
 * Pure capacity math for per-day starting quantities. No database, no
 * Express — the same split as lib/orders.ts (business rules) vs
 * routes/orders.ts (HTTP): this is the part that gets unit tests, per
 * specs/ENGINEERING_RULES.md "Testing bar".
 *
 * See supabase/migrations/0007_add_daily_inventory.sql for the storage
 * model, and docs/adr/0010-per-day-inventory.md for why remaining is
 * derived rather than stored.
 */

/** What's known about one product on one date. */
export type Availability = {
  /** null = no cap set for that date, i.e. unlimited. */
  startQuantity: number | null;
  /** Quantity already ordered for that date (cancelled orders excluded). */
  ordered: number;
};

/**
 * What's left, or null when the date is uncapped.
 *
 * Clamped at 0: an oversold day (the cap was lowered below what's
 * already been ordered, which the admin is allowed to do — see
 * setStartQuantity) reports 0 left, never a negative "we owe you" count
 * that would read like a credit in the UI.
 */
export function remainingQuantity({ startQuantity, ordered }: Availability): number | null {
  if (startQuantity === null) return null;
  return Math.max(0, startQuantity - ordered);
}

/** True when this product can't take any more orders for the date. */
export function isSoldOutByCount(availability: Availability): boolean {
  return remainingQuantity(availability) === 0;
}

export type RequestedLine = {
  productId: string;
  name: string;
  quantity: number;
};

export type Shortfall = {
  productId: string;
  name: string;
  requested: number;
  remaining: number;
};

/**
 * The lines of a cart that ask for more than the date has left. An empty
 * result means the whole cart fits.
 *
 * A product with no entry in `availabilityByProductId` is treated as
 * uncapped, matching the table's "no row = unlimited" rule — a missing
 * entry must never read as "zero available," which would reject every
 * order for every date nobody has planned yet.
 */
export function findShortfalls(
  lines: RequestedLine[],
  availabilityByProductId: Map<string, Availability>
): Shortfall[] {
  const shortfalls: Shortfall[] = [];

  for (const line of lines) {
    const availability = availabilityByProductId.get(line.productId);
    if (!availability) continue;

    const remaining = remainingQuantity(availability);
    if (remaining === null) continue;

    if (line.quantity > remaining) {
      shortfalls.push({
        productId: line.productId,
        name: line.name,
        requested: line.quantity,
        remaining,
      });
    }
  }

  return shortfalls;
}

/**
 * Customer-facing explanations for each shortfall, one per line, in this
 * API's error-envelope style (plain sentences — see
 * specs/ENGINEERING_RULES.md "Error envelope"). Says what's actually
 * left so the customer can fix the cart in one try instead of guessing,
 * and points at the other dates rather than dead-ending.
 */
export function shortfallMessages(shortfalls: Shortfall[]): string[] {
  return shortfalls.map(({ name, requested, remaining }) =>
    remaining === 0
      ? `${name} is sold out for that date. Please pick another date.`
      : `Only ${remaining} ${name} left for that date — you asked for ${requested}. Please lower the quantity or pick another date.`
  );
}
