import { describe, expect, it } from "vitest";
import {
  addDays,
  groupByRequestedDate,
  isSettled,
  itemTotals,
  orderBucket,
  orderViewCounts,
  ordersForView,
  parseOrderView,
  parseAdminTab,
  parseDayParam,
  adminHref,
  ORDER_VIEWS,
} from "@/lib/adminOrders";
import type { OrderStatus } from "@/lib/types";

const TODAY = "2026-11-10";

const order = (
  requestedDate: string,
  status: OrderStatus = "PENDING",
  createdAt = "2026-11-01T00:00:00Z"
) => ({ requestedDate, status, createdAt });

describe("addDays", () => {
  it("moves a date-only string forward", () => {
    expect(addDays("2026-11-10", 1)).toBe("2026-11-11");
  });

  it("crosses a month boundary", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
  });

  it("crosses a year boundary", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("handles a leap day", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("orderBucket", () => {
  it("puts today's order in today", () => {
    expect(orderBucket(order(TODAY), TODAY)).toBe("today");
  });

  it("puts tomorrow's order in tomorrow", () => {
    expect(orderBucket(order("2026-11-11"), TODAY)).toBe("tomorrow");
  });

  it("puts anything later in upcoming", () => {
    expect(orderBucket(order("2026-11-12"), TODAY)).toBe("upcoming");
    expect(orderBucket(order("2027-06-01"), TODAY)).toBe("upcoming");
  });

  it("archives a finished order from a past date", () => {
    expect(orderBucket(order("2026-11-09", "COMPLETED"), TODAY)).toBe("archive");
    expect(orderBucket(order("2026-11-09", "CANCELLED"), TODAY)).toBe("archive");
  });

  it("flags an unfinished past order as past due, never archived", () => {
    // The safety net: this is the case that must not silently vanish.
    expect(orderBucket(order("2026-11-09", "PENDING"), TODAY)).toBe("pastDue");
    expect(orderBucket(order("2026-11-09", "READY"), TODAY)).toBe("pastDue");
  });

  it("keeps today's finished order under today, not archive", () => {
    // Today's list is the day's whole picture, done items included.
    expect(orderBucket(order(TODAY, "COMPLETED"), TODAY)).toBe("today");
  });

  it("buckets every order into exactly one view", () => {
    const orders = [
      order(TODAY),
      order("2026-11-11"),
      order("2026-11-20"),
      order("2026-10-01", "COMPLETED"),
      order("2026-10-02", "PENDING"),
    ];
    const counts = orderViewCounts(orders, TODAY);
    const bucketed = ORDER_VIEWS.filter((v) => v !== "all").reduce((sum, v) => sum + counts[v], 0);
    expect(bucketed).toBe(orders.length);
    expect(counts.all).toBe(orders.length);
  });
});

describe("isSettled", () => {
  it("is true only for completed and cancelled", () => {
    expect(isSettled("COMPLETED")).toBe(true);
    expect(isSettled("CANCELLED")).toBe(true);
    expect(isSettled("PENDING")).toBe(false);
    expect(isSettled("CONFIRMED")).toBe(false);
    expect(isSettled("READY")).toBe(false);
  });
});

describe("ordersForView", () => {
  it("sorts forward-looking views soonest first", () => {
    const orders = [order("2026-11-20"), order("2026-11-13"), order("2026-11-15")];
    expect(ordersForView(orders, "upcoming", TODAY).map((o) => o.requestedDate)).toEqual([
      "2026-11-13",
      "2026-11-15",
      "2026-11-20",
    ]);
  });

  it("sorts the archive newest first", () => {
    const orders = [
      order("2026-10-01", "COMPLETED"),
      order("2026-11-01", "COMPLETED"),
      order("2026-09-01", "CANCELLED"),
    ];
    expect(ordersForView(orders, "archive", TODAY).map((o) => o.requestedDate)).toEqual([
      "2026-11-01",
      "2026-10-01",
      "2026-09-01",
    ]);
  });

  it("keeps same-day orders in creation order", () => {
    const orders = [
      order(TODAY, "PENDING", "2026-11-05T10:00:00Z"),
      order(TODAY, "PENDING", "2026-11-05T08:00:00Z"),
    ];
    expect(ordersForView(orders, "today", TODAY).map((o) => o.createdAt)).toEqual([
      "2026-11-05T08:00:00Z",
      "2026-11-05T10:00:00Z",
    ]);
  });

  it("returns everything for the all view", () => {
    const orders = [order(TODAY), order("2026-01-01", "COMPLETED")];
    expect(ordersForView(orders, "all", TODAY)).toHaveLength(2);
  });

  it("does not mutate the input array", () => {
    const orders = [order("2026-11-20"), order("2026-11-13")];
    const snapshot = orders.map((o) => o.requestedDate);
    ordersForView(orders, "upcoming", TODAY);
    expect(orders.map((o) => o.requestedDate)).toEqual(snapshot);
  });
});

describe("groupByRequestedDate", () => {
  it("groups consecutive orders under their date, preserving order", () => {
    const orders = [order("2026-11-13"), order("2026-11-13"), order("2026-11-15")];
    const groups = groupByRequestedDate(orders);
    expect(groups.map((g) => g.date)).toEqual(["2026-11-13", "2026-11-15"]);
    expect(groups[0].orders).toHaveLength(2);
  });

  it("returns nothing for no orders", () => {
    expect(groupByRequestedDate([])).toEqual([]);
  });
});

describe("parseOrderView", () => {
  it("accepts a known view", () => {
    expect(parseOrderView("archive")).toBe("archive");
  });

  it("falls back to today for junk, missing, or repeated values", () => {
    expect(parseOrderView("nonsense")).toBe("today");
    expect(parseOrderView(undefined)).toBe("today");
    expect(parseOrderView(["archive", "all"])).toBe("archive");
  });
});

describe("itemTotals", () => {
  const line = (name: string, quantity: number) => ({ name, quantity });

  it("adds up quantities per item across orders", () => {
    const totals = itemTotals([
      { status: "PENDING", items: [line("Sourdough", 2), line("Cookies", 1)] },
      { status: "CONFIRMED", items: [line("Sourdough", 3)] },
    ]);
    expect(totals).toEqual([line("Cookies", 1), line("Sourdough", 5)]);
  });

  it("ignores cancelled orders but keeps completed ones", () => {
    const totals = itemTotals([
      { status: "CANCELLED", items: [line("Sourdough", 9)] },
      { status: "COMPLETED", items: [line("Sourdough", 1)] },
    ]);
    expect(totals).toEqual([line("Sourdough", 1)]);
  });

  it("is empty for no orders", () => {
    expect(itemTotals([])).toEqual([]);
  });
});

describe("parseAdminTab", () => {
  it("accepts a known tab", () => {
    expect(parseAdminTab("catalog")).toBe("catalog");
  });

  it("falls back to orders for anything else", () => {
    expect(parseAdminTab("nonsense")).toBe("orders");
    expect(parseAdminTab(undefined)).toBe("orders");
  });
});

describe("parseDayParam", () => {
  it("accepts a real date", () => {
    expect(parseDayParam("2026-12-24", TODAY)).toBe("2026-12-24");
  });

  it("falls back to today when absent or malformed", () => {
    expect(parseDayParam(undefined, TODAY)).toBe(TODAY);
    expect(parseDayParam("12/24/2026", TODAY)).toBe(TODAY);
    expect(parseDayParam("", TODAY)).toBe(TODAY);
  });

  it("rejects a well-formed date that doesn't exist", () => {
    // JavaScript would roll this into March and quietly show a day the
    // URL never asked for.
    expect(parseDayParam("2026-02-31", TODAY)).toBe(TODAY);
    expect(parseDayParam("2026-13-01", TODAY)).toBe(TODAY);
  });

  it("accepts a real leap day and rejects a fake one", () => {
    expect(parseDayParam("2028-02-29", TODAY)).toBe("2028-02-29");
    expect(parseDayParam("2027-02-29", TODAY)).toBe(TODAY);
  });
});

describe("adminHref", () => {
  it("builds a link carrying the state it's given", () => {
    expect(adminHref({ tab: "catalog", date: "2026-11-12" })).toBe(
      "/admin?tab=catalog&date=2026-11-12"
    );
  });

  it("is the bare dashboard with no state", () => {
    expect(adminHref({})).toBe("/admin");
  });
});
