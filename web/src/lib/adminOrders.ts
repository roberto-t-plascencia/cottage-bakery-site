/**
 * How the admin dashboard slices the order list, kept as pure functions
 * so it's unit-testable with no Next.js, no fetch and no database — the
 * same reasoning as cart.ts (see ../../docs/TESTING_STRATEGY.md and
 * ../../../specs/ENGINEERING_RULES.md "Testing bar").
 *
 * The problem this solves: `GET /orders` returns every order ever
 * placed, newest first, and the dashboard rendered all of them in one
 * table. That's unmanageable the moment the bakery has more than a few
 * weeks of history, and it buries the only question the baker actually
 * has in the morning — "what am I baking today?"
 *
 * Every order lands in exactly one bucket, so nothing can be filtered
 * into invisibility: the buckets partition the list rather than
 * overlapping. That's what makes "Past due" safe to rely on — an order
 * whose date has passed and was never finished can't quietly fall out of
 * every view.
 */
import { parseDateOnly, toDateInputValue } from "./cart";
import type { OrderStatus } from "./types";

export const ORDER_VIEWS = ["today", "tomorrow", "upcoming", "pastDue", "archive", "all"] as const;

export type OrderView = (typeof ORDER_VIEWS)[number];

export const DEFAULT_ORDER_VIEW: OrderView = "today";

/** Labels for the view pills, in display order. */
export const ORDER_VIEW_LABELS: Record<OrderView, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  upcoming: "Upcoming",
  pastDue: "Past due",
  archive: "Archive",
  all: "All",
};

export const ORDER_VIEW_DESCRIPTIONS: Record<OrderView, string> = {
  today: "Orders wanted today.",
  tomorrow: "Orders wanted tomorrow — what to prep tonight.",
  upcoming: "Everything ordered for the day after tomorrow onward.",
  pastDue:
    "Past dates that were never completed or cancelled. If this isn't empty, something slipped.",
  archive: "Finished and cancelled orders from past dates. Nothing here needs doing.",
  all: "Every order ever placed, newest first.",
};

/** Statuses that mean an order needs nothing further from the bakery. */
const SETTLED_STATUSES: OrderStatus[] = ["COMPLETED", "CANCELLED"];

export function isSettled(status: OrderStatus): boolean {
  return SETTLED_STATUSES.includes(status);
}

/** The calendar date `days` after a "YYYY-MM-DD" string, as the same shape. */
export function addDays(isoDateOnly: string, days: number): string {
  const date = parseDateOnly(isoDateOnly);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
}

type Bucketable = { requestedDate: string; status: OrderStatus };

/**
 * Which single view an order belongs to, given today's bakery date.
 *
 * "all" is deliberately not a bucket — it's a view that shows
 * everything, not a place an order can live. Date comparisons are plain
 * string comparisons, which is exact for zero-padded "YYYY-MM-DD" and
 * avoids constructing Date objects (and the timezone traps that come
 * with them) entirely — see ENGINEERING_RULES "Date-only values."
 */
export function orderBucket(
  order: Bucketable,
  today: string
): Exclude<OrderView, "all"> {
  if (order.requestedDate === today) return "today";
  if (order.requestedDate === addDays(today, 1)) return "tomorrow";
  if (order.requestedDate > today) return "upcoming";
  return isSettled(order.status) ? "archive" : "pastDue";
}

/**
 * The orders belonging to one view, sorted the way that view is read.
 *
 * Forward-looking views sort soonest-first (that's the order they'll be
 * baked in); backward-looking ones sort newest-first (that's the order
 * they'll be asked about). Within a date, creation order is preserved so
 * two orders for the same day keep a stable, predictable sequence.
 */
export function ordersForView<T extends Bucketable & { createdAt: string }>(
  orders: T[],
  view: OrderView,
  today: string
): T[] {
  const selected = view === "all" ? [...orders] : orders.filter((o) => orderBucket(o, today) === view);
  const newestFirst = view === "archive" || view === "all" || view === "pastDue";

  return selected.sort((a, b) => {
    if (a.requestedDate !== b.requestedDate) {
      return newestFirst
        ? b.requestedDate.localeCompare(a.requestedDate)
        : a.requestedDate.localeCompare(b.requestedDate);
    }
    return a.createdAt.localeCompare(b.createdAt);
  });
}

/** How many orders each view holds, for the counts on the pills. */
export function orderViewCounts<T extends Bucketable>(
  orders: T[],
  today: string
): Record<OrderView, number> {
  const counts: Record<OrderView, number> = {
    today: 0,
    tomorrow: 0,
    upcoming: 0,
    pastDue: 0,
    archive: 0,
    all: orders.length,
  };
  for (const order of orders) counts[orderBucket(order, today)] += 1;
  return counts;
}

/**
 * Orders grouped under their requested date, in the order the view
 * already sorted them — so a view spanning several days renders as "Fri
 * 13th: 3 orders / Sat 14th: 1 order" instead of one undifferentiated
 * table. Preserves input order rather than re-sorting, so this can't
 * disagree with ordersForView about what comes first.
 */
export function groupByRequestedDate<T extends Bucketable>(
  orders: T[]
): { date: string; orders: T[] }[] {
  const groups: { date: string; orders: T[] }[] = [];
  for (const order of orders) {
    const last = groups.at(-1);
    if (last?.date === order.requestedDate) {
      last.orders.push(order);
    } else {
      groups.push({ date: order.requestedDate, orders: [order] });
    }
  }
  return groups;
}

/** Narrows an arbitrary `?orders=` query value to a real view. */
export function parseOrderView(value: string | string[] | undefined): OrderView {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ORDER_VIEWS.includes(candidate as OrderView)
    ? (candidate as OrderView)
    : DEFAULT_ORDER_VIEW;
}

/** Item totals across a set of orders — the bake list for a day. */
export function itemTotals(
  orders: { items: { name: string; quantity: number }[]; status: OrderStatus }[]
): { name: string; quantity: number }[] {
  const totals = new Map<string, number>();
  for (const order of orders) {
    // A cancelled order isn't getting baked; a completed one already
    // was, and still counts as part of the day's output.
    if (order.status === "CANCELLED") continue;
    for (const item of order.items) {
      totals.set(item.name, (totals.get(item.name) ?? 0) + item.quantity);
    }
  }
  return [...totals].map(([name, quantity]) => ({ name, quantity })).sort((a, b) => a.name.localeCompare(b.name));
}

// --- the rest of what the dashboard reads out of its query string ---
// Both tabs and the day picker are plain links and a plain form, so the
// URL is the whole of the page's state: it survives a refresh, it can be
// bookmarked ("tomorrow's bake list"), and the page stays a Server
// Component with no client-side state to get out of sync.

export const ADMIN_TABS = ["orders", "catalog"] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export const DEFAULT_ADMIN_TAB: AdminTab = "orders";

/** Narrows an arbitrary `?tab=` value to a real tab. */
export function parseAdminTab(value: string | string[] | undefined): AdminTab {
  const candidate = Array.isArray(value) ? value[0] : value;
  return ADMIN_TABS.includes(candidate as AdminTab) ? (candidate as AdminTab) : DEFAULT_ADMIN_TAB;
}

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Narrows an arbitrary `?date=` value to a real calendar date,
 * falling back to `today`.
 *
 * Rejects well-formed-but-impossible dates ("2026-02-31") by checking
 * the parsed date formats back to the same string — otherwise the day
 * view would silently show a different day than the URL claims, since
 * JavaScript rolls February 31st over into March.
 */
export function parseDayParam(value: string | string[] | undefined, today: string): string {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (!candidate || !DATE_ONLY_RE.test(candidate)) return today;
  return toDateInputValue(parseDateOnly(candidate)) === candidate ? candidate : today;
}

/** A link back to the dashboard preserving the parts of its state that still apply. */
export function adminHref(params: { tab?: AdminTab; orders?: OrderView; date?: string }): string {
  const query = new URLSearchParams();
  if (params.tab) query.set("tab", params.tab);
  if (params.orders) query.set("orders", params.orders);
  if (params.date) query.set("date", params.date);
  const suffix = query.toString();
  return suffix ? `/admin?${suffix}` : "/admin";
}
