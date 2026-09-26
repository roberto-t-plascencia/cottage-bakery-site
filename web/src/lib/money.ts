/**
 * Turns what the owner types in a price box ("5.99", "$12", "7.5") into
 * integer cents, or null if it isn't a price. Cents only, never floats,
 * per specs/ENGINEERING_RULES.md "Money".
 */
export function dollarsToCents(input: string): number | null {
  const cleaned = input.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const [whole, fraction = ""] = cleaned.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}
