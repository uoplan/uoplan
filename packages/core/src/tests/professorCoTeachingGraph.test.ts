import { describe, expect, it } from "vitest";
import { buildProfessorCoTeachingGraph, professorGraphId } from "../professorCoTeachingGraph";
import type { ProfessorCoTeachingGraph } from "../professorCoTeachingGraph";
import type { CourseGradesData } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";

function emptyDist() {
  return { "A+": 0, A: 0 };
}

function buildFixture(): CourseGradesData {
  return {
    courses: [
      {
        code: normalizeCourseCode("CSI 2110"),
        sections: [
          { name: "Alice Shared", legacyId: 1, termId: 2251, distribution: emptyDist() },
          { name: "Alice Shared", legacyId: 1, termId: 2241, distribution: emptyDist() },
          { name: "Bob Shared", legacyId: 2, termId: 2251, distribution: emptyDist() },
        ],
      },
      {
        code: normalizeCourseCode("MAT 1341"),
        sections: [
          { name: "Alice Shared", legacyId: 1, termId: 2251, distribution: emptyDist() },
          { name: "Bob Shared", legacyId: 2, termId: 2241, distribution: emptyDist() },
          { name: "Bob Shared", legacyId: 2, termId: 2231, distribution: emptyDist() },
        ],
      },
      {
        code: normalizeCourseCode("PHY 1121"),
        sections: [{ name: "Carol Solo", termId: 2251, distribution: emptyDist() }],
      },
    ],
  };
}

function nodeById(graph: ProfessorCoTeachingGraph, id: string) {
  const n = graph.nodes.find((x) => x.id === id);
  if (!n) throw new Error(`missing node ${id}`);
  return n;
}

function edgeWeight(graph: ProfessorCoTeachingGraph, a: string, b: string) {
  const keyA = a < b ? a : b;
  const keyB = a < b ? b : a;
  return graph.edges.find((e) => e.source === keyA && e.target === keyB)?.weight;
}

describe("professorGraphId", () => {
  it("prefers legacyId when present", () => {
    expect(professorGraphId(42, "Jane Doe")).toBe("id:42");
  });

  it("falls back to normalized name", () => {
    expect(professorGraphId(undefined, "  Jane   Doe ")).toBe("name:jane doe");
  });
});

describe("buildProfessorCoTeachingGraph", () => {
  it("creates weighted edges from shared courses and computes degree", () => {
    const graph = buildProfessorCoTeachingGraph(buildFixture());
    const alice = professorGraphId(1, "Alice Shared");
    const bob = professorGraphId(2, "Bob Shared");
    const carol = professorGraphId(undefined, "Carol Solo");

    expect(graph.nodes).toHaveLength(3);
    expect(edgeWeight(graph, alice, bob)).toBe(2);
    expect(nodeById(graph, alice).degree).toBe(1);
    expect(nodeById(graph, bob).degree).toBe(1);
    expect(nodeById(graph, carol).degree).toBe(0);
  });

  it("collects subject prefixes and section weights per professor", () => {
    const graph = buildProfessorCoTeachingGraph(buildFixture());
    const alice = nodeById(graph, professorGraphId(1, "Alice Shared"));
    expect(alice.subjects).toEqual(["CSI", "MAT"]);
    expect(alice.disciplineWeights).toEqual({ CSI: 2, MAT: 1 });
    const carol = nodeById(graph, professorGraphId(undefined, "Carol Solo"));
    expect(carol.subjects).toEqual(["PHY"]);
    expect(carol.disciplineWeights).toEqual({ PHY: 1 });
  });

  it("accumulates min offering counts per shared course", () => {
    const graph = buildProfessorCoTeachingGraph({
      courses: [
        {
          code: normalizeCourseCode("ADM 1100"),
          sections: [
            { name: "P1", legacyId: 10, termId: 1, distribution: emptyDist() },
            { name: "P1", legacyId: 10, termId: 2, distribution: emptyDist() },
            { name: "P2", legacyId: 20, termId: 1, distribution: emptyDist() },
          ],
        },
      ],
    });
    const w = edgeWeight(graph, professorGraphId(10, "P1"), professorGraphId(20, "P2"));
    expect(w).toBe(1);
  });
});
