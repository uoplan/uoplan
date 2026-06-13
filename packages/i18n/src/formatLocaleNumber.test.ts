import { beforeEach, describe, expect, it } from "vitest";
import { formatLocaleNumber, i18n } from "./index";

describe("formatLocaleNumber", () => {
  beforeEach(() => {
    i18n.load("en", {});
    i18n.activate("en");
  });

  it("formats thousands with grouping in English", () => {
    expect(formatLocaleNumber(12000)).toBe("12,000");
  });

  it("formats thousands with grouping in French", () => {
    i18n.activate("fr-CA");
    const formatted = formatLocaleNumber(12000);
    expect(formatted.replaceAll(/\s|\u202f/g, " ")).toBe("12 000");
  });

  it("formats decimals per locale", () => {
    i18n.activate("fr-CA");
    expect(formatLocaleNumber(2.7, { minimumFractionDigits: 1, maximumFractionDigits: 1 })).toBe(
      "2,7",
    );
  });
});
