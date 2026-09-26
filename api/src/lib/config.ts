/**
 * Deliberately duplicated from web/src/lib/config.ts — same reasoning as
 * cart.ts in this directory (see docs/adr/0004-service-boundary.md and
 * specs/ENGINEERING_RULES.md "Duplicated code, on purpose"). This
 * service only reads `shippableState` (the legal constraint
 * `validateOrder` enforces); the rest is here so the two copies stay
 * structurally identical and a future admin-facing endpoint (e.g.
 * "email the customer using bakeryConfig.contactEmail") doesn't need to
 * re-derive it.
 */
export const bakeryConfig = {
  businessName: "Mission Valley Home Bakers",
  tagline: "Small-batch bakes, made to order in a licensed home kitchen.",
  ownerName: "Roberto Plascencia",
  city: "San Diego",
  zip: "92108",
  county: "San Diego",
  registrationNumber: "DEH2026-FCFO-002557",
  contactEmail: "robplascencia@gmail.com",
  contactPhone: "(858) 373-9363",
  instagramHandle: "@yourcottagebakery",
  serviceCounty: "San Diego",
  // Class A CFOs may only ship/deliver directly to consumers within
  // California. This drives delivery-address validation in ./orders.ts.
  shippableState: "CA",
  fulfillmentOptions: [
    { id: "PICKUP", label: "Pickup", description: "Free pickup from the home kitchen, by appointment." },
    { id: "LOCAL_DELIVERY", label: "Local delivery", description: "$3 delivery within the service county, free on orders of $25 or more." },
    {
      id: "IN_STATE_SHIPPING",
      label: "Shipping (within California only)",
      description: "Shipped via USPS/UPS/FedEx to a California address. Cottage food law prohibits shipping out of state.",
    },
  ] as const,
} as const;

export type FulfillmentOptionId = (typeof bakeryConfig.fulfillmentOptions)[number]["id"];
