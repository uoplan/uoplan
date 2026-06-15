import { describe, expect, it } from "vitest";
import { buildProfessorCoTeachingGraph, professorGraphId } from "@uoplan/core";
import type { CourseGradesData } from "@uoplan/core";
import { testCourseCode, testProfessorName } from "../../test/brands";
import {
  buildOfferingsByProfessorId,
  getAggregateGradeViz,
  getGraphNeighbors,
  sortGraphNeighbors,
} from "./professorGraphDetails";

function buildFixture(): CourseGradesData {
  return {
    courses: [
      {
        code: testCourseCode("CSI 2110"),
        sections: [
          {
            name: "Alice Shared",
            legacyId: 1,
            termId: 2251,
            distribution: { "A+": 10, A: 5, B: 2 },
          },
          { name: "Bob Shared", legacyId: 2, termId: 2251, distribution: { "A+": 3, A: 7 } },
        ],
      },
      {
        code: testCourseCode("MAT 1341"),
        sections: [
          { name: "Alice Shared", legacyId: 1, termId: 2251, distribution: { B: 8, C: 2 } },
          { name: "Bob Shared", legacyId: 2, termId: 2241, distribution: { A: 12 } },
        ],
      },
    ],
  };
}

describe("buildOfferingsByProfessorId", () => {
  it("keys offerings by professor graph id", () => {
    const byId = buildOfferingsByProfessorId(buildFixture());
    const aliceId = professorGraphId(1, "Alice Shared");
    expect(byId.get(aliceId)).toHaveLength(2);
    expect(byId.get(professorGraphId(2, "Bob Shared"))).toHaveLength(2);
  });
});

describe("getAggregateGradeViz", () => {
  it("merges distributions across offerings", () => {
    const byId = buildOfferingsByProfessorId(buildFixture());
    const aliceId = professorGraphId(1, "Alice Shared");
    const viz = getAggregateGradeViz(byId.get(aliceId) ?? []);
    expect(viz).not.toBeNull();
    expect(viz!.total).toBe(27);
  });

  it("returns null for empty offerings", () => {
    expect(getAggregateGradeViz([])).toBeNull();
  });
});

describe("getGraphNeighbors and sortGraphNeighbors", () => {
  it("returns incident neighbors with weights", () => {
    const grades = buildFixture();
    const graph = buildProfessorCoTeachingGraph(grades);
    const nodesById = new Map(graph.nodes.map((n) => [n.id, n]));
    const aliceId = professorGraphId(1, "Alice Shared");

    const neighbors = getGraphNeighbors(graph, aliceId, nodesById);
    expect(neighbors).toHaveLength(1);
    expect(neighbors[0].node.displayName).toBe("Bob Shared");
    expect(neighbors[0].weight).toBe(2);
  });

  it("sorts by strength then name", () => {
    const neighbors = [
      {
        node: {
          id: "b",
          displayName: testProfessorName("Zed"),
          degree: 1,
          disciplineWeights: {},
          subjects: [],
        },
        weight: 1,
      },
      {
        node: {
          id: "a",
          displayName: testProfessorName("Amy"),
          degree: 1,
          disciplineWeights: {},
          subjects: [],
        },
        weight: 3,
      },
    ];

    const byStrength = sortGraphNeighbors(neighbors, "strength");
    expect(byStrength[0].node.displayName).toBe("Amy");
    expect(byStrength[1].node.displayName).toBe("Zed");

    const byName = sortGraphNeighbors(neighbors, "name");
    expect(byName.map((n) => n.node.displayName)).toEqual(["Amy", "Zed"]);
  });
});
