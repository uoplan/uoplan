import { describe, expect, it } from "vitest";
import type { ComboboxItem } from "@mantine/core";
import { createRankedOptionsFilter, rankOptionMatch } from "./optionRanking";

describe("rankOptionMatch", () => {
  it("ranks an exact code match best", () => {
    expect(rankOptionMatch("bio", { code: "BIO", text: "Biology" })).toBe(0);
  });

  it("ranks a code prefix above a name prefix", () => {
    const codePrefix = rankOptionMatch("bio", { code: "BIOM", text: "Biomechanics" });
    const namePrefix = rankOptionMatch("bio", { code: "BCH", text: "Biochemistry" });
    expect(codePrefix).toBe(1);
    expect(namePrefix).toBe(2);
    expect(codePrefix).toBeLessThan(namePrefix!);
  });

  it("ranks a substring-only match last", () => {
    expect(rankOptionMatch("bio", { code: "MCG", text: "Microbiology" })).toBe(3);
  });

  it("returns null when nothing matches", () => {
    expect(rankOptionMatch("zzz", { code: "BIO", text: "Biology" })).toBeNull();
  });

  it("returns the passthrough tier for an empty query", () => {
    expect(rankOptionMatch("   ", { code: "BIO", text: "Biology" })).toBe(0);
  });

  it("requires every word to match (AND) and scores by the strongest tier", () => {
    expect(rankOptionMatch("bio cell", { code: "BIO", text: "Cell Biology" })).toBe(0);
    expect(rankOptionMatch("bio nope", { code: "BIO", text: "Biology" })).toBeNull();
  });
});

describe("createRankedOptionsFilter", () => {
  const options: ComboboxItem[] = [
    { value: "BCH", label: "BCH" },
    { value: "BIO", label: "BIO" },
    { value: "MCG", label: "MCG" },
    { value: "BIOM", label: "BIOM" },
  ];
  const names: Record<string, string> = {
    BCH: "Biochemistry",
    BIO: "Biology",
    MCG: "Microbiology",
    BIOM: "Biomedical Science",
  };
  const filter = createRankedOptionsFilter((o) => ({ code: o.value, text: names[o.value] ?? "" }));

  it("surfaces the exact code match first for 'bio'", () => {
    const result = filter({ options, search: "bio", limit: Infinity }) as ComboboxItem[];
    expect(result.map((o) => o.value)).toEqual(["BIO", "BIOM", "BCH", "MCG"]);
  });

  it("drops non-matches", () => {
    const result = filter({ options, search: "xyz", limit: Infinity }) as ComboboxItem[];
    expect(result).toHaveLength(0);
  });

  it("breaks ties alphabetically by code", () => {
    const tied: ComboboxItem[] = [
      { value: "PSY", label: "PSY" },
      { value: "PHY", label: "PHY" },
    ];
    const tiedFilter = createRankedOptionsFilter((o) => ({ code: o.value, text: "" }));
    const result = tiedFilter({ options: tied, search: "p", limit: Infinity }) as ComboboxItem[];
    expect(result.map((o) => o.value)).toEqual(["PHY", "PSY"]);
  });

  it("passes options through unchanged for an empty query", () => {
    const result = filter({ options, search: "", limit: Infinity });
    expect(result).toBe(options);
  });
});
