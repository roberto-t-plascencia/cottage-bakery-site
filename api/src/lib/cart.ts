/**
 * Deliberately duplicated subset of web/src/lib/cart.ts.
 *
 * There's no shared runtime package between web/ and api/ (see
 * docs/adr/0004-service-boundary.md — a shared package would quietly
 * reintroduce the coupling the service split is meant to remove, a
 * "distributed monolith"). These few pure, well-tested functions are
 * small and stable enough that hand-keeping two copies in sync is
 * cheaper than the alternative. See specs/ENGINEERING_RULES.md
 * "Duplicated code, on purpose" for the rule this follows and what would
 * change the calculus.
 *
 * web/'s copy has more functions (client-side cart mutation, currency
 * formatting) that this service has no use for — only the date-only
 * handling and the cart-total math that `validateOrder` needs are
 * mirrored here.
 */

export type CartLine = {
  productId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
};

// Same-day orders are accepted until these times (bakery time, minutes
// after midnight); from then on, the earliest ready date is tomorrow.
// Local delivery runs later than pickup. The bakery is open every day;
// running out of something for the day is handled per product, not by
// this rule.
const SAME_DAY_CUTOFF_MINUTES: Record<string, number> = {
  PICKUP: 20 * 60, // 8:00 PM
  LOCAL_DELIVERY: 21 * 60 + 30, // 9:30 PM
  IN_STATE_SHIPPING: 20 * 60, // 8:00 PM
};

export function sameDayCutoffMinutes(fulfillmentMethod: string): number {
  return SAME_DAY_CUTOFF_MINUTES[fulfillmentMethod] ?? SAME_DAY_CUTOFF_MINUTES.PICKUP;
}

/** "8 PM", "9:30 PM" */
export function formatCutoff(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

export function cartSubtotalCents(cart: CartLine[]): number {
  return cart.reduce((sum, line) => sum + line.unitPriceCents * line.quantity, 0);
}

/**
 * Earliest date a new order could be ready: today until the same-day
 * cutoff, tomorrow after it.
 * Exported so the checkout form (web/) and this service's validation
 * share one *definition* of the rule, even without sharing code — see
 * specs/ENGINEERING_RULES.md for why this rule living in
 * two files is a rule this project accepts rather than a bug.
 */
export function earliestReadyDate(
  fulfillmentMethod: string = "PICKUP",
  from: Date = new Date()
): Date {
  const result = bakeryCalendarDate(from);
  const now = bakeryNow(from);
  if (now.hour * 60 + now.minute >= sameDayCutoffMinutes(fulfillmentMethod)) {
    result.setDate(result.getDate() + 1);
  }
  return result;
}

/**
 * The bakery's timezone: every "which day is it?" question in this rule
 * is answered here, never in whatever timezone the code happens to run
 * in. Before this, the browser counted days in the customer's local time
 * while api/ (on Vercel) counted in UTC, so from 5 PM Pacific onward —
 * already "tomorrow" in UTC — the server's earliest date ran a day ahead
 * of the checkout form's, and every order placed that evening was
 * rejected as "too soon."
 */
export const BAKERY_TIME_ZONE = "America/Los_Angeles";

/**
 * The calendar date it currently is at the bakery, as a Date at *local*
 * midnight of that date — the same shape parseDateOnly returns, so the
 * lead-time comparison compares like with like in any runtime timezone.
 */
export function bakeryCalendarDate(now: Date = new Date()): Date {
  const { year, month, day } = bakeryNow(now);
  return new Date(year, month - 1, day);
}

function bakeryNow(now: Date): { year: number; month: number; day: number; hour: number; minute: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: BAKERY_TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)!.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour"), minute: get("minute") };
}

/**
 * Parses a bare "YYYY-MM-DD" string (what web/'s `<input type="date">`
 * sends, and what's stored in Postgres' `date` column) into a Date at
 * *local* midnight. Deliberately not `new Date(isoDateOnly)`: that parses
 * as UTC midnight, and `validateOrder`'s lead-time comparison works in
 * local time — feeding it a UTC-midnight Date would silently shift the
 * requested date back a day for this server's timezone, which could
 * reject a valid order as "too soon" with no visible cause. See
 * web/src/lib/cart.ts for the full account of this bug and the test that
 * pins it down.
 */
export function parseDateOnly(isoDateOnly: string): Date {
  const [year, month, day] = isoDateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}
