/**
 * Cart math, kept as pure functions with no framework or storage
 * dependencies. That's what makes cart.test.ts able to test real business
 * logic (rounding, empty carts, quantity edge cases) without spinning up
 * React or a database — the cheapest tests catch the most common bugs.
 */

export type CartLine = {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
};

export const MIN_LEAD_TIME_DAYS = 2;

export function addToCart(
  cart: CartLine[],
  line: Omit<CartLine, "quantity">,
  quantity: number
): CartLine[] {
  if (quantity <= 0) {
    throw new Error("Quantity must be a positive integer");
  }

  const existing = cart.find((c) => c.productId === line.productId);
  if (existing) {
    return cart.map((c) =>
      c.productId === line.productId
        ? { ...c, quantity: c.quantity + quantity }
        : c
    );
  }

  return [...cart, { ...line, quantity }];
}

export function removeFromCart(cart: CartLine[], productId: string): CartLine[] {
  return cart.filter((c) => c.productId !== productId);
}

export function updateQuantity(
  cart: CartLine[],
  productId: string,
  quantity: number
): CartLine[] {
  if (quantity <= 0) {
    return removeFromCart(cart, productId);
  }
  return cart.map((c) => (c.productId === productId ? { ...c, quantity } : c));
}

export function cartSubtotalCents(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

export function cartItemCount(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

export function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
  });
}

/**
 * Earliest date a new order could be ready, given baking lead time.
 * Exported so the checkout form and server-side validation share one
 * definition instead of drifting apart.
 */
export function earliestReadyDate(from: Date = new Date()): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + MIN_LEAD_TIME_DAYS);
  return result;
}

/**
 * Formats a Date as "YYYY-MM-DD" using its *local* calendar date — for
 * populating a `<input type="date">`'s value/min attribute. Deliberately
 * not `date.toISOString().slice(0, 10)`: toISOString converts to UTC
 * first, which silently rolls back to the previous day for any negative
 * UTC offset (e.g. US timezones) when the local time is past midnight but
 * before the UTC offset catches up — the classic "date picker is off by
 * one depending on what time of day it is" bug.
 */
export function toDateInputValue(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Formats a bare "YYYY-MM-DD" date-only string (as stored in Postgres'
 * `date` column and returned by Supabase) for display. Deliberately not
 * `new Date(isoDateOnly).toDateString()`: a date-only string is parsed as
 * UTC midnight per spec, which — once rendered in a negative-UTC-offset
 * local timezone — can display as the *previous* calendar day (e.g.
 * "2026-09-21" showing as "Sun Sep 20" in Pacific time). Building the
 * Date from explicit local year/month/day components sidesteps that.
 */
export function formatDateOnly(isoDateOnly: string): string {
  return parseDateOnly(isoDateOnly).toDateString();
}

/**
 * Parses a bare "YYYY-MM-DD" string (what `<input type="date">` sends,
 * and what gets stored in Postgres' `date` column) into a Date at *local*
 * midnight. Deliberately not `new Date(isoDateOnly)`: that parses as UTC
 * midnight, and every lead-time comparison in `validateOrder`
 * (src/lib/orders.ts) works in local time via `setHours(0, 0, 0, 0)` —
 * feeding it a UTC-midnight Date silently shifts the requested date back
 * a day for anyone west of UTC, which could reject a valid order as "too
 * soon" (or accept one that's actually a day short of the lead time) with
 * no visible cause. This is the single place that string becomes a Date,
 * so every caller (the order API route, tests) should go through this
 * rather than calling `new Date(...)` on it directly.
 */
export function parseDateOnly(isoDateOnly: string): Date {
  const [year, month, day] = isoDateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}
