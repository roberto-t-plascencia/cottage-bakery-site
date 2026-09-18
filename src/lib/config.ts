/**
 * Single source of truth for bakery business info.
 *
 * Deliberately config-driven rather than hardcoded across pages: swapping
 * to a different bakery's branding/content should mean editing this file,
 * not hunting through JSX. Same instinct as externalizing config in any
 * production app — one seam, not scattered magic strings.
 */
export const bakeryConfig = {
  businessName: "Your Cottage Bakery",
  tagline: "Small-batch bakes, made to order in a licensed home kitchen.",
  ownerName: "Your Name",
  city: "Your City",
  zip: "00000",
  county: "Your County",
  // California cottage food registration number issued by the county health
  // department. Required on every product label — see docs/adr/0002.
  registrationNumber: "CFO-XXXXXX",
  contactEmail: "hello@example.com",
  contactPhone: "(555) 555-5555",
  instagramHandle: "@yourcottagebakery",
  serviceCounty: "Your County",
  // Class A CFOs may only ship/deliver directly to consumers within
  // California. This list drives delivery-address validation.
  shippableState: "CA",
  fulfillmentOptions: [
    {
      id: "PICKUP",
      label: "Pickup",
      description: "Free pickup from the home kitchen, by appointment.",
    },
    {
      id: "LOCAL_DELIVERY",
      label: "Local delivery",
      description: "Delivered within the service county for a flat fee.",
    },
    {
      id: "IN_STATE_SHIPPING",
      label: "Shipping (within California only)",
      description:
        "Shipped via USPS/UPS/FedEx to a California address. Cottage food law prohibits shipping out of state.",
    },
  ] as const,
} as const;

export type FulfillmentOptionId =
  (typeof bakeryConfig.fulfillmentOptions)[number]["id"];
