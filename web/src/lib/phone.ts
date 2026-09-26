/**
 * US phone numbers, shown as (###) ###-####. The order form formats as
 * the customer types; api/src/lib/phone.ts does the real check and
 * stores the same format. Duplicated on purpose (same reason as fees.ts).
 */

/** Digits only, without a leading US country code 1. At most 10. */
export function phoneDigits(value: string): string {
  return value.replace(/\D/g, "").replace(/^1/, "").slice(0, 10);
}

/** Formats whatever has been typed so far: "858" → "(858", "8583739363" → "(858) 373-9363". */
export function formatPhoneInput(value: string): string {
  const d = phoneDigits(value);
  if (d.length === 0) return "";
  if (d.length < 4) return `(${d}`;
  if (d.length < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

export function isCompletePhone(value: string): boolean {
  return phoneDigits(value).length === 10;
}
