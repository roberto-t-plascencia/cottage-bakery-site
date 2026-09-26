/**
 * Turns a Geoapify Address Autocomplete result into the one-line address
 * the order form stores, e.g. "4550 Mission Gorge Pl, San Diego, CA 92120".
 * Kept separate from the component so it can be unit-tested.
 */
export type GeoapifyAddress = {
  place_id?: string;
  name?: string;
  housenumber?: string;
  street?: string;
  city?: string;
  state_code?: string;
  postcode?: string;
  formatted?: string;
};

/** "4550 Mission Gorge Pl", or the street or place name when there's no house number. */
export function streetLine(a: GeoapifyAddress): string {
  if (a.housenumber && a.street) return `${a.housenumber} ${a.street}`;
  return a.street ?? a.name ?? "";
}

/** "San Diego, CA 92120" */
export function cityLine(a: GeoapifyAddress): string {
  const stateZip = [a.state_code, a.postcode].filter(Boolean).join(" ");
  return [a.city, stateZip].filter(Boolean).join(", ");
}

export function formatAddress(a: GeoapifyAddress): string {
  const street = streetLine(a);
  if (street && a.city && a.state_code) return `${street}, ${cityLine(a)}`;
  return (a.formatted ?? street).replace(/,\s*United States( of America)?$/, "");
}
