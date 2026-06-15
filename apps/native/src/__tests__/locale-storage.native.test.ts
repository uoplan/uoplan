import {
  parseLocaleOverride,
  serializeLocaleOverride,
} from "@/i18n/locale-storage";

describe("parseLocaleOverride", () => {
  it("reads a stored app locale", () => {
    expect(parseLocaleOverride('{"locale":"fr-CA"}')).toBe("fr-CA");
    expect(parseLocaleOverride('{"locale":"en"}')).toBe("en");
  });

  it("treats an explicit null as 'follow system'", () => {
    expect(parseLocaleOverride('{"locale":null}')).toBeNull();
  });

  it("falls back to null for unknown locales or malformed shapes", () => {
    expect(parseLocaleOverride('{"locale":"de"}')).toBeNull();
    expect(parseLocaleOverride('{"locale":42}')).toBeNull();
    expect(parseLocaleOverride('{"other":"en"}')).toBeNull();
    expect(parseLocaleOverride("not json")).toBeNull();
    expect(parseLocaleOverride("[]")).toBeNull();
  });
});

describe("serializeLocaleOverride", () => {
  it("round-trips through parseLocaleOverride", () => {
    expect(parseLocaleOverride(serializeLocaleOverride("fr-CA"))).toBe("fr-CA");
    expect(parseLocaleOverride(serializeLocaleOverride("en"))).toBe("en");
    expect(parseLocaleOverride(serializeLocaleOverride(null))).toBeNull();
  });

  it("serializes the documented `{ locale }` shape", () => {
    expect(JSON.parse(serializeLocaleOverride("en"))).toEqual({ locale: "en" });
    expect(JSON.parse(serializeLocaleOverride(null))).toEqual({ locale: null });
  });
});
