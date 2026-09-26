import { describe, expect, it } from "vitest";
import { slugify } from "../../src/lib/slug";

describe("slugify", () => {
  it("matches the slugs the menu already uses", () => {
    expect(slugify("Artisan Sourdough Baguette")).toBe("artisan-sourdough-baguette");
    expect(slugify("Prague Trdelník with Walnuts")).toBe("prague-trdelnik-with-walnuts");
    expect(slugify("Garlic & Herb Focaccia")).toBe("garlic-and-herb-focaccia");
  });

  it("drops punctuation and extra spaces", () => {
    expect(slugify("  Pan de Masa Madre!! (Large) ")).toBe("pan-de-masa-madre-large");
  });

  it("returns an empty string when nothing usable is left", () => {
    expect(slugify("!!!")).toBe("");
  });
});
