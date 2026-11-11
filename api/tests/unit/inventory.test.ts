import { describe, expect, it } from "vitest";
import {
  findShortfalls,
  isSoldOutByCount,
  remainingQuantity,
  shortfallMessages,
  type Availability,
} from "../../src/lib/inventory";

describe("remainingQuantity", () => {
  it("subtracts what's ordered from the day's starting quantity", () => {
    expect(remainingQuantity({ startQuantity: 10, ordered: 3 })).toBe(7);
  });

  it("returns null for a date with no cap set, rather than 0 or Infinity", () => {
    // The whole "no row means unlimited" rule from migration 0007 rests
    // on this: null here, never a number, so an uncapped day can't be
    // compared against 0 and read as sold out.
    expect(remainingQuantity({ startQuantity: null, ordered: 99 })).toBeNull();
  });

  it("clamps an oversold day at 0 instead of going negative", () => {
    // Happens when the baker lowers a cap below what's already been
    // ordered — allowed on purpose (see setStartQuantity).
    expect(remainingQuantity({ startQuantity: 4, ordered: 6 })).toBe(0);
  });

  it("is 0, not null, for a day deliberately set to zero", () => {
    expect(remainingQuantity({ startQuantity: 0, ordered: 0 })).toBe(0);
  });
});

describe("isSoldOutByCount", () => {
  it("is true only when a cap exists and is used up", () => {
    expect(isSoldOutByCount({ startQuantity: 2, ordered: 2 })).toBe(true);
    expect(isSoldOutByCount({ startQuantity: 2, ordered: 1 })).toBe(false);
    expect(isSoldOutByCount({ startQuantity: null, ordered: 100 })).toBe(false);
  });
});

describe("findShortfalls", () => {
  const sourdough = "11111111-1111-1111-1111-111111111111";
  const cookies = "22222222-2222-2222-2222-222222222222";

  const availability = (entries: [string, Availability][]) => new Map(entries);

  it("accepts a cart that fits inside the day's remaining count", () => {
    const result = findShortfalls(
      [{ productId: sourdough, name: "Sourdough", quantity: 2 }],
      availability([[sourdough, { startQuantity: 10, ordered: 7 }]])
    );
    expect(result).toEqual([]);
  });

  it("accepts a cart taking exactly what's left", () => {
    const result = findShortfalls(
      [{ productId: sourdough, name: "Sourdough", quantity: 3 }],
      availability([[sourdough, { startQuantity: 10, ordered: 7 }]])
    );
    expect(result).toEqual([]);
  });

  it("reports the line that asks for more than is left, with the real remainder", () => {
    const result = findShortfalls(
      [{ productId: sourdough, name: "Sourdough", quantity: 4 }],
      availability([[sourdough, { startQuantity: 10, ordered: 7 }]])
    );
    expect(result).toEqual([
      { productId: sourdough, name: "Sourdough", requested: 4, remaining: 3 },
    ]);
  });

  it("treats a product with no entry as uncapped", () => {
    // A missing entry must never read as "none left" — that would
    // reject every order for every date nobody has planned.
    const result = findShortfalls(
      [{ productId: cookies, name: "Cookies", quantity: 500 }],
      availability([[sourdough, { startQuantity: 1, ordered: 1 }]])
    );
    expect(result).toEqual([]);
  });

  it("reports every short line, not just the first", () => {
    const result = findShortfalls(
      [
        { productId: sourdough, name: "Sourdough", quantity: 2 },
        { productId: cookies, name: "Cookies", quantity: 5 },
      ],
      availability([
        [sourdough, { startQuantity: 1, ordered: 0 }],
        [cookies, { startQuantity: 4, ordered: 4 }],
      ])
    );
    expect(result.map((s) => s.name)).toEqual(["Sourdough", "Cookies"]);
  });
});

describe("shortfallMessages", () => {
  it("says what's left when some is left", () => {
    expect(
      shortfallMessages([{ productId: "p", name: "Sourdough", requested: 4, remaining: 3 }])
    ).toEqual([
      "Only 3 Sourdough left for that date — you asked for 4. Please lower the quantity or pick another date.",
    ]);
  });

  it("says sold out when none is left, without a confusing \"only 0\"", () => {
    expect(
      shortfallMessages([{ productId: "p", name: "Sourdough", requested: 1, remaining: 0 }])
    ).toEqual(["Sourdough is sold out for that date. Please pick another date."]);
  });
});
