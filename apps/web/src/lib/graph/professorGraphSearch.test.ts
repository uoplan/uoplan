import { describe, expect, it } from "vitest";
import { buildProfessorSearchEntries, searchProfessors } from "./professorGraphSearch";
import type { ProfessorGraphNode } from "schedule";

function node(
  partial: Partial<ProfessorGraphNode> & Pick<ProfessorGraphNode, "id" | "displayName">,
): ProfessorGraphNode {
  return {
    degree: 0,
    disciplineWeights: {},
    subjects: [],
    ...partial,
  };
}

describe("searchProfessors", () => {
  const entries = buildProfessorSearchEntries([
    node({ id: "a", displayName: "Alice Anderson", legacyId: 100 }),
    node({ id: "b", displayName: "Bob Smith" }),
    node({ id: "c", displayName: "Carol Zhang" }),
  ]);

  it("returns empty for blank query", () => {
    expect(searchProfessors(entries, "")).toEqual([]);
    expect(searchProfessors(entries, "   ")).toEqual([]);
  });

  it("matches substring on name", () => {
    expect(searchProfessors(entries, "smith").map((e) => e.id)).toEqual(["b"]);
  });

  it("matches legacy id", () => {
    expect(searchProfessors(entries, "100").map((e) => e.id)).toEqual(["a"]);
  });

  it("ranks prefix matches before substring matches", () => {
    const results = searchProfessors(entries, "al");
    expect(results[0]?.displayName).toBe("Alice Anderson");
  });
});
