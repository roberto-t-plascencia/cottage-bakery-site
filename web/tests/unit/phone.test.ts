import { describe, expect, it } from "vitest";
import { formatPhoneInput, isCompletePhone } from "../../src/lib/phone";

describe("formatPhoneInput", () => {
  it("formats as the customer types", () => {
    expect(formatPhoneInput("")).toBe("");
    expect(formatPhoneInput("8")).toBe("(8");
    expect(formatPhoneInput("858")).toBe("(858");
    expect(formatPhoneInput("8583")).toBe("(858) 3");
    expect(formatPhoneInput("858373")).toBe("(858) 373");
    expect(formatPhoneInput("8583739")).toBe("(858) 373-9");
    expect(formatPhoneInput("8583739363")).toBe("(858) 373-9363");
  });

  it("reformats pasted numbers and drops a leading +1", () => {
    expect(formatPhoneInput("858.373.9363")).toBe("(858) 373-9363");
    expect(formatPhoneInput("+1 858-373-9363")).toBe("(858) 373-9363");
  });

  it("ignores digits past ten", () => {
    expect(formatPhoneInput("85837393631234")).toBe("(858) 373-9363");
  });

  it("lets backspace remove the last digit", () => {
    // Deleting the "3" from "(858) 3" leaves "(858) ", which is 3 digits.
    expect(formatPhoneInput("(858) ")).toBe("(858");
  });

  it("knows when the number is complete", () => {
    expect(isCompletePhone("(858) 373-936")).toBe(false);
    expect(isCompletePhone("(858) 373-9363")).toBe(true);
  });
});
