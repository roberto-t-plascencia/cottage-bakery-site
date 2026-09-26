import { describe, expect, it } from "vitest";
import { cityLine, formatAddress, streetLine } from "../../src/lib/address";

describe("formatAddress", () => {
  const result = {
    housenumber: "4550",
    street: "Mission Gorge Place",
    city: "San Diego",
    state_code: "CA",
    postcode: "92120",
    formatted: "4550 Mission Gorge Place, San Diego, CA 92120, United States of America",
  };

  it("builds a one-line US address from the parts", () => {
    expect(formatAddress(result)).toBe("4550 Mission Gorge Place, San Diego, CA 92120");
  });

  it("splits the dropdown's two lines", () => {
    expect(streetLine(result)).toBe("4550 Mission Gorge Place");
    expect(cityLine(result)).toBe("San Diego, CA 92120");
  });

  it("falls back to the formatted address without the country", () => {
    expect(
      formatAddress({ formatted: "Main Street, Julian, CA 92036, United States of America" })
    ).toBe("Main Street, Julian, CA 92036");
  });
});
