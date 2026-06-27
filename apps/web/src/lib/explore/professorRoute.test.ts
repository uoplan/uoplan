import { describe, expect, it } from "vitest";
import { buildProfessorRegistry, slugifyProfessor, unsafeBrand } from "@uoplan/core";
import type { CanonicalProfessorName } from "@uoplan/core";
import { professorRouteParam, resolveProfessorRoute } from "./professorRoute";

const name = (value: string) => unsafeBrand<CanonicalProfessorName>(value);

function registryOf(entries: Array<{ name: string; legacyIds?: number[]; aliases?: string[] }>) {
  return buildProfessorRegistry(
    entries.map((e) => ({
      slug: slugifyProfessor(e.name),
      name: name(e.name),
      legacyIds: e.legacyIds ?? [],
      aliases: e.aliases ?? [],
    })),
  );
}

describe("professorRouteParam", () => {
  it("returns a kebab-case slug derived from the name when no slug is provided", () => {
    const param = professorRouteParam({ displayName: name("José Ramírez") });
    expect(param).toBe("jose-ramirez");
    expect(param).not.toMatch(/[%\s]/);
  });

  it("never percent-encodes a name with spaces, accents, or punctuation", () => {
    const param = professorRouteParam({ displayName: name("Renée O'Brien-Smith") });
    expect(param).toBe("renee-o-brien-smith");
    expect(param).not.toContain("%");
  });

  it("prefers an explicit (deduped) registry slug when given", () => {
    expect(professorRouteParam({ slug: "john-smith-2", displayName: name("John Smith") })).toBe(
      "john-smith-2",
    );
  });
});

describe("resolveProfessorRoute round-trips a slugified name", () => {
  it("resolves a name-derived slug back to the registry entry via the match key", () => {
    const registry = registryOf([{ name: "José Ramírez" }]);
    const param = professorRouteParam({ displayName: name("José Ramírez") });
    const resolved = resolveProfessorRoute(registry, param);
    expect(resolved.entry?.name).toBe("José Ramírez");
  });

  it("resolves the canonical slug for a registry entry built from schedule data", () => {
    const registry = registryOf([{ name: "Renée O'Brien" }]);
    const resolved = resolveProfessorRoute(registry, "renee-o-brien");
    expect(resolved.entry?.name).toBe("Renée O'Brien");
  });
});
