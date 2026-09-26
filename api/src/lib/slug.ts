/**
 * URL-safe id for a product, from its name: "Prague Trdelník with
 * Walnuts" → "prague-trdelnik-with-walnuts". Accents are dropped rather
 * than the letter ("í" → "i"), and "&" becomes "and".
 */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
}
