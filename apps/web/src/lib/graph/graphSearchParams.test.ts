import { describe, expect, it } from "vitest";
import type { ProfessorGraphNode } from "schedule";
import { parseProfessorSearchParam, professorToSearchParam } from "./graphSearchParams";

function node(
  partial: Partial<ProfessorGraphNode> & Pick<ProfessorGraphNode, "id" | "displayName">,
) {
  return {
    degree: 0,
    disciplineWeights: {},
    subjects: [],
    ...partial,
  };
}

describe("graphSearchParams", () => {
  const janeLegacy = node({ id: "id:42", displayName: "Jane", legacyId: 42 });
  const janeName = node({ id: "name:jane doe", displayName: "Jane Doe" });
  const nodesById = new Map<string, ProfessorGraphNode>([
    [janeLegacy.id, janeLegacy],
    [janeName.id, janeName],
  ]);

  it("professorToSearchParam prefers legacy id", () => {
    expect(professorToSearchParam(node({ id: "id:42", displayName: "Jane", legacyId: 42 }))).toBe(
      "42",
    );
    expect(professorToSearchParam(node({ id: "name:jane doe", displayName: "Jane Doe" }))).toBe(
      "name:jane doe",
    );
  });

  it("parseProfessorSearchParam resolves legacy id and graph ids", () => {
    expect(parseProfessorSearchParam("42", nodesById)).toBe("id:42");
    expect(parseProfessorSearchParam("id:42", nodesById)).toBe("id:42");
    expect(parseProfessorSearchParam("name:jane doe", nodesById)).toBe("name:jane doe");
    expect(parseProfessorSearchParam("missing", nodesById)).toBeNull();
  });
});
