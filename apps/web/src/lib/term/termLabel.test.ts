import { beforeAll, describe, expect, it } from "vitest";
import { i18n } from "../../i18n";
import { formatTermLabel, formatTermLabelPlain } from "./termLabel";

beforeAll(async () => {
  const { messages } = await import("@uoplan/i18n/catalogs/en");
  i18n.load("en", messages);
  i18n.activate("en");
});

describe("formatTermLabel", () => {
  it("formats Fall / Winter / Spring–Summer streams as '<Season> <Year>'", () => {
    expect(formatTermLabel(2269)).toBe("Fall 2026");
    expect(formatTermLabel(2271)).toBe("Winter 2027");
    expect(formatTermLabel(2275)).toBe("Summer 2027");
    expect(formatTermLabel(2261)).toBe("Winter 2026");
    expect(formatTermLabel(2251)).toBe("Winter 2025");
  });

  it("accepts string term ids", () => {
    expect(formatTermLabel("2269")).toBe("Fall 2026");
  });

  it("falls back to digits for unknown lengths or session digits", () => {
    expect(formatTermLabel(999)).toBe("999");
    expect(formatTermLabel(2260)).toBe("2260");
    expect(formatTermLabel(1269)).toBe("1269");
    expect(formatTermLabel("not-a-term")).toBe("not-a-term");
  });

  it("localizes season names in French", async () => {
    const { messages } = await import("@uoplan/i18n/catalogs/fr-CA");
    i18n.load("fr-CA", messages);
    i18n.activate("fr-CA");
    expect(formatTermLabel(2261)).toBe("Hiver 2026");
    expect(formatTermLabel(2269)).toBe("Automne 2026");
    expect(formatTermLabel(2275)).toBe("Été 2027");
    i18n.activate("en");
  });
});

describe("formatTermLabelPlain", () => {
  it("always returns English labels regardless of active locale", () => {
    expect(formatTermLabelPlain(2269)).toBe("Fall 2026");
    expect(formatTermLabelPlain(2271)).toBe("Winter 2027");
    expect(formatTermLabelPlain(2275)).toBe("Summer 2027");
    expect(formatTermLabelPlain("2251")).toBe("Winter 2025");
  });

  it("falls back to digits for undecodable ids", () => {
    expect(formatTermLabelPlain(999)).toBe("999");
    expect(formatTermLabelPlain(2260)).toBe("2260");
    expect(formatTermLabelPlain("not-a-term")).toBe("not-a-term");
  });
});
