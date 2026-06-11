import { describe, expect, it } from "vitest";
import {
  buildProfessorRegistry,
  createResolverFromRegistry,
  type RegistryInputs,
} from "./buildRegistry.ts";

describe("buildProfessorRegistry", () => {
  const inputs: RegistryInputs = {
    rmp: [
      { name: "Geneviève Tellier", legacyId: 44863, rating: 2.7, numRatings: 27 },
      { name: "Genevieve Tellier", legacyId: 2517780, rating: 2.0, numRatings: 2 },
      { name: "Staff", legacyId: 999, rating: 5, numRatings: 1 },
    ],
    grades: [{ name: "Andrea Siebra Vinet" }, { name: "Andréa Vinet" }],
    schedules: ["Alain Saint-Amant", "Alain St-Amant", "Staff"],
    feedback: ["Geneviève Tellier"],
  };

  it("merges variants and combines RMP reviews (response-weighted)", () => {
    const registry = buildProfessorRegistry(inputs);
    const tellier = registry.find((e) => e.slug === "genevieve-tellier");
    expect(tellier).toBeDefined();
    expect(tellier!.legacyIds).toEqual([44863, 2517780]);
    // (2.7*27 + 2.0*2) / 29 = 2.65 -> 2.7 (1 dp)
    expect(tellier!.rating).toBe(2.7);
    expect(tellier!.numRatings).toBe(29);
    expect(tellier!.name).toBe("Geneviève Tellier");
  });

  it("drops Staff/placeholder names", () => {
    const registry = buildProfessorRegistry(inputs);
    expect(registry.some((e) => /staff/i.test(e.name))).toBe(false);
  });

  it("merges hyphen/particle surnames and picks the fullest name", () => {
    const registry = buildProfessorRegistry(inputs);
    const vinet = registry.find((e) => e.slug.startsWith("andrea") && e.slug.endsWith("vinet"));
    expect(vinet?.name).toBe("Andrea Siebra Vinet");
    const amant = registry.find((e) => e.slug === "alain-saint-amant");
    expect(amant).toBeDefined();
    expect(amant!.aliases).toContain("Alain St-Amant");
  });

  it("resolver maps names and legacyIds to registry indices", () => {
    const registry = buildProfessorRegistry(inputs);
    const resolver = createResolverFromRegistry(registry);
    const idx = registry.findIndex((e) => e.slug === "genevieve-tellier");
    expect(resolver.index("Genevieve Tellier")).toBe(idx);
    expect(resolver.indexForLegacyId(2517780)).toBe(idx);
    expect(resolver.index("Staff")).toBeNull();
  });

  it("force-split override separates legacyIds sharing a first+last key", () => {
    const registry = buildProfessorRegistry({
      rmp: [
        { name: "John Smith", legacyId: 1, rating: 4, numRatings: 10 },
        { name: "John Smith", legacyId: 2, rating: 2, numRatings: 10 },
      ],
      grades: [],
      schedules: [],
      feedback: [],
      overrides: { split: [{ key: "john|smith", groups: [[2]] }] },
    });
    const smiths = registry.filter((e) => e.slug.startsWith("john-smith"));
    expect(smiths.length).toBe(2);
  });
});
