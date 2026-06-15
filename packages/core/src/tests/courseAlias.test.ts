import { describe, expect, it } from "vitest";
import { aliasSiblings, buildAliasGroups, resolveComponentId } from "../courseAlias";
import type { Catalogue, Course } from "../dataTypes/domain";
import { normalizeCourseCode } from "../utils/courseUtils";

function aliasCatalogue(rows: { code: string; aliases?: string[] }[]): Catalogue {
  const courses = rows.map<Course>((r) => ({
    code: normalizeCourseCode(r.code),
    title: r.code,
    credits: 3,
    description: "",
    aliases: r.aliases?.map((a) => normalizeCourseCode(a)),
  }));
  return { courses, programs: [] };
}

describe("buildAliasGroups", () => {
  it("forms a transitive component keyed by the smallest member code", () => {
    const { componentByNorm, membersByComponent } = buildAliasGroups(
      aliasCatalogue([
        { code: "STA 2391", aliases: ["MAT 2377"] },
        { code: "MAT 2377", aliases: ["MAT 2371"] },
      ]),
    );
    const id = componentByNorm.get(normalizeCourseCode("STA 2391"));
    expect(id).toBe(normalizeCourseCode("MAT 2371"));
    expect(componentByNorm.get(normalizeCourseCode("MAT 2377"))).toBe(id);
    expect(membersByComponent.get(normalizeCourseCode("MAT 2371"))).toEqual([
      normalizeCourseCode("MAT 2371"),
      normalizeCourseCode("MAT 2377"),
      normalizeCourseCode("STA 2391"),
    ]);
  });

  it("merges a shared alias across distinct courses into one component", () => {
    const { membersByComponent } = buildAliasGroups(
      aliasCatalogue([
        { code: "ART 3916", aliases: ["ART 3016"] },
        { code: "ART 3917", aliases: ["ART 3016"] },
      ]),
    );
    expect([...membersByComponent.values()][0]).toHaveLength(3);
  });

  it("omits standalone courses and tolerates a null catalogue", () => {
    expect(
      buildAliasGroups(aliasCatalogue([{ code: "CSI 2110" }])).componentByNorm.has(
        normalizeCourseCode("CSI 2110"),
      ),
    ).toBe(false);
    expect(buildAliasGroups(null).componentByNorm.size).toBe(0);
  });
});

describe("resolveComponentId / aliasSiblings", () => {
  const groups = buildAliasGroups(
    aliasCatalogue([
      { code: "STA 2391", aliases: ["MAT 2377"] },
      { code: "MAT 2377", aliases: ["MAT 2371"] },
    ]),
  );

  it("resolves a member to its component id and a standalone code to itself", () => {
    expect(resolveComponentId(normalizeCourseCode("STA 2391"), groups.componentByNorm)).toBe(
      normalizeCourseCode("MAT 2371"),
    );
    expect(resolveComponentId(normalizeCourseCode("CSI 2110"), groups.componentByNorm)).toBe(
      normalizeCourseCode("CSI 2110"),
    );
  });

  it("lists the other member codes, excluding the queried one", () => {
    expect(aliasSiblings(normalizeCourseCode("MAT 2377"), groups)).toEqual([
      normalizeCourseCode("MAT 2371"),
      normalizeCourseCode("STA 2391"),
    ]);
    expect(aliasSiblings(normalizeCourseCode("CSI 2110"), groups)).toEqual([]);
  });
});
