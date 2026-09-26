import { describe, expect, it } from "vitest";
import { dollarsToCents } from "../../src/lib/money";

describe("dollarsToCents", () => {
  it("reads the ways people type prices", () => {
    expect(dollarsToCents("5.99")).toBe(599);
    expect(dollarsToCents("$12")).toBe(1200);
    expect(dollarsToCents("7.5")).toBe(750);
    expect(dollarsToCents(" 1,000.00 ")).toBe(100000);
  });

  it("never goes through floating point", () => {
    // 0.29 * 100 is 28.999999999999996 in floating point.
    expect(dollarsToCents("0.29")).toBe(29);
  });

  it("rejects anything that isn't a price", () => {
    expect(dollarsToCents("")).toBeNull();
    expect(dollarsToCents("five")).toBeNull();
    expect(dollarsToCents("5.999")).toBeNull();
    expect(dollarsToCents("-3")).toBeNull();
  });
});
