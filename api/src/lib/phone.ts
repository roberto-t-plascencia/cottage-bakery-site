/**
 * US phone numbers, stored as (###) ###-####. The web form formats as the
 * customer types (web/src/lib/phone.ts); this is the check that counts.
 */

/**
 * Returns the number as "(###) ###-####", or null when it isn't a
 * 10-digit US number. Accepts any punctuation and a leading +1 or 1.
 */
export function normalizeUsPhone(value: string): string | null {
  let d = value.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
  if (d.length !== 10) return null;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}
