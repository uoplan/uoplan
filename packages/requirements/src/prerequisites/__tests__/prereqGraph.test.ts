import { describe, expect, it } from "vitest";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { Course, CoursePrereqKind, CoursePrereqNode } from "@uoplan/domain/dataTypes";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import type { PrereqContext } from "../types";
import { buildPrereqGraph, PREREQ_GRAPH_FAN_OUT_LIMIT } from "../graph";
import type {
  PrereqGraph,
  PrereqGraphAggregateNode,
  PrereqGraphCourseNode,
  PrereqGraphGateNode,
  PrereqGraphSemanticNode,
  PrereqGraphTr,
} from "../graph";

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function code(raw: string): NormalizedCourseCode {
  return normalizeCourseCode(raw);
}

function makeCourse(c: string, credits = 3, prereqs?: CoursePrereqNode): Course {
  return {
    code: code(c),
    title: c,
    credits,
    description: "",
    ...(prereqs ? { prerequisites: prereqs } : {}),
  };
}

function makeCache(courses: Course[]): DataCache {
  const map = new Map<NormalizedCourseCode, Course>();
  for (const c of courses) {
    map.set(c.code, c);
  }
  return {
    getCourse: (c) => map.get(normalizeCourseCode(c)),
    resolveToCanonical: (c) => normalizeCourseCode(c),
    getAllCourses: () => courses,
    getCoursesByDiscipline: () => [],
    getSchedule: () => map.get("__never__" as NormalizedCourseCode) as never,
    getAllSchedules: () => [],
    getFaculty: () => map.get("__never__" as NormalizedCourseCode) as never,
    getFacultyForDiscipline: () => map.get("__never__" as NormalizedCourseCode) as never,
    getDisciplinesByFaculty: () => [],
    getCoursesByFaculty: () => [],
  };
}

function makeCtx(taken: string[], totalCredits?: number, programs?: string[]): PrereqContext {
  const takenList = taken.map((c) => ({
    code: code(c),
    credits: 3,
    discipline: c.split(" ")[0] ?? "",
    level: 1000,
  }));
  return {
    taken: takenList,
    totalCredits: totalCredits ?? takenList.length * 3,
    disciplineCredits: takenList.reduce(
      (acc, t) => {
        acc[t.discipline] = (acc[t.discipline] ?? 0) + t.credits;
        return acc;
      },
      {} as Record<string, number>,
    ),
    studentPrograms: programs ?? [],
  };
}

const mockTr: PrereqGraphTr = (id: string, values?: Record<string, string | number>) => {
  if (!values || Object.keys(values).length === 0) return id;
  const parts = Object.entries(values).map(([k, v]) => `${k}=${v}`);
  return `${id}(${parts.join(", ")})`;
};

function build(
  courseCode: string,
  prereqRoot: CoursePrereqNode,
  ctx: PrereqContext | null = null,
  cache: DataCache | null = null,
  fanOutLimit?: number,
): PrereqGraph {
  return buildPrereqGraph({
    courseCode: code(courseCode),
    prereqRoot,
    plannerContext: ctx,
    cache,
    tr: mockTr,
    ...(fanOutLimit !== undefined ? { fanOutLimit } : {}),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("prereqGraph", () => {
  describe("constants", () => {
    it("PREREQ_GRAPH_FAN_OUT_LIMIT is 4", () => {
      expect(PREREQ_GRAPH_FAN_OUT_LIMIT).toBe(4);
    });
  });

  describe("single course prerequisite", () => {
    const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };

    it("met when course is in context", () => {
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const courseNode = graph.nodes.find(
        (n) => n.kind === "course" && n.role === "prerequisite",
      ) as PrereqGraphCourseNode;
      expect(courseNode.status).toBe("met");
      expect(courseNode.code).toBe(code("CSI 2101"));
    });

    it("missing when course is not in context", () => {
      const ctx = makeCtx(["MAT 1300"]);
      const graph = build("CSI 3101", prereq, ctx);
      const courseNode = graph.nodes.find(
        (n) => n.kind === "course" && n.role === "prerequisite",
      ) as PrereqGraphCourseNode;
      expect(courseNode.status).toBe("missing");
    });

    it("unknown when no context", () => {
      const graph = build("CSI 3101", prereq, null);
      const courseNode = graph.nodes.find(
        (n) => n.kind === "course" && n.role === "prerequisite",
      ) as PrereqGraphCourseNode;
      expect(courseNode.status).toBe("unknown");
    });
  });

  describe("language variant", () => {
    it("met when language variant is in context", () => {
      // CSI 2101 has French variant CSI 2501
      const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };
      const ctx = makeCtx(["CSI 2501"]);
      const graph = build("CSI 3101", prereq, ctx);
      const courseNode = graph.nodes.find(
        (n) => n.kind === "course" && n.role === "prerequisite",
      ) as PrereqGraphCourseNode;
      expect(courseNode.status).toBe("met");
    });
  });

  describe("unresolvable course", () => {
    it("malformed code gets unknown status and resolvable false", () => {
      const prereq: CoursePrereqNode = { type: "course", code: "INVALID" };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const courseNode = graph.nodes.find(
        (n) => n.kind === "course" && n.role === "prerequisite",
      ) as PrereqGraphCourseNode;
      expect(courseNode.status).toBe("unknown");
      expect(courseNode.resolvable).toBe(false);
    });

    it("valid-looking course absent from the cache is unknown and not linked", () => {
      const prereq: CoursePrereqNode = { type: "course", code: "MAT 2120" };
      const cache = makeCache([makeCourse("CSI 3101")]);
      const graph = build("CSI 3101", prereq, makeCtx([]), cache);
      const courseNode = graph.nodes.find(
        (n) => n.kind === "course" && n.role === "prerequisite",
      ) as PrereqGraphCourseNode;

      expect(courseNode.resolvable).toBe(false);
      expect(courseNode.status).toBe("unknown");
      expect(graph.a11yDescription).toContain("prereqGraph.status.unknown");
    });
  });

  describe("AND gate three-state logic", () => {
    const prereq: CoursePrereqNode = {
      type: "and_group",
      children: [
        { type: "course", code: "CSI 2101" },
        { type: "course", code: "MAT 1300" },
      ],
    };

    it("all met => met", () => {
      const ctx = makeCtx(["CSI 2101", "MAT 1300"]);
      const graph = build("CSI 3101", prereq, ctx);
      const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("met");
    });

    it("any missing => missing", () => {
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("missing");
    });

    it("no context => unknown", () => {
      const graph = build("CSI 3101", prereq, null);
      const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("unknown");
    });

    it("mix of met and unknown (no missing) => unknown", () => {
      // One met course + one unresolvable => unknown, not missing
      const mixed: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "INVALID" },
        ],
      };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", mixed, ctx);
      const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("unknown");
    });
  });

  describe("OR gate three-state logic", () => {
    const prereq: CoursePrereqNode = {
      type: "or_group",
      children: [
        { type: "course", code: "CSI 2101" },
        { type: "course", code: "MAT 1300" },
      ],
    };

    it("any met => met", () => {
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const gate = graph.nodes.find((n) => n.kind === "or_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("met");
    });

    it("all missing => missing", () => {
      const ctx = makeCtx(["PHY 1100"]);
      const graph = build("CSI 3101", prereq, ctx);
      const gate = graph.nodes.find((n) => n.kind === "or_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("missing");
    });

    it("no context => unknown", () => {
      const graph = build("CSI 3101", prereq, null);
      const gate = graph.nodes.find((n) => n.kind === "or_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("unknown");
    });

    it("mix of missing and unknown => unknown", () => {
      const mixed: CoursePrereqNode = {
        type: "or_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "INVALID" },
        ],
      };
      const ctx = makeCtx(["PHY 1100"]);
      const graph = build("CSI 3101", mixed, ctx);
      const gate = graph.nodes.find((n) => n.kind === "or_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("unknown");
    });
  });

  describe("nested AND-of-OR", () => {
    const prereq: CoursePrereqNode = {
      type: "and_group",
      children: [
        {
          type: "or_group",
          children: [
            { type: "course", code: "CSI 2101" },
            { type: "course", code: "CSI 2501" },
          ],
        },
        { type: "course", code: "MAT 1300" },
      ],
    };

    it("met when one from each or and the and", () => {
      const ctx = makeCtx(["CSI 2501", "MAT 1300"]);
      const graph = build("CSI 3101", prereq, ctx);
      const andGate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(andGate.status).toBe("met");
    });

    it("missing when and fails", () => {
      const ctx = makeCtx(["CSI 2501"]);
      const graph = build("CSI 3101", prereq, ctx);
      const andGate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(andGate.status).toBe("missing");
    });
  });

  describe("target node inherits root status", () => {
    it("target gets root gate status", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "MAT 1300" },
        ],
      };
      const ctx = makeCtx(["CSI 2101", "MAT 1300"]);
      const graph = build("CSI 3101", prereq, ctx);
      const target = graph.nodes.find(
        (n) => n.kind === "course" && n.role === "target",
      ) as PrereqGraphCourseNode;
      expect(target.status).toBe("met");
    });

    it("target gets single prerequisite status", () => {
      const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };
      const ctx = makeCtx([]);
      const graph = build("CSI 3101", prereq, ctx);
      const target = graph.nodes.find(
        (n) => n.kind === "course" && n.role === "target",
      ) as PrereqGraphCourseNode;
      expect(target.status).toBe("missing");
    });
  });

  describe("edge status inherits source status", () => {
    it("edge from met node has met status", () => {
      const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const edge = graph.edges[0];
      expect(edge).toBeDefined();
      expect(edge!.status).toBe("met");
    });

    it("edge from missing node has missing status", () => {
      const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };
      const ctx = makeCtx([]);
      const graph = build("CSI 3101", prereq, ctx);
      const edge = graph.edges[0];
      expect(edge).toBeDefined();
      expect(edge!.status).toBe("missing");
    });
  });

  describe("credits total (non_course with credits, no constraints)", () => {
    it("met when total credits sufficient", () => {
      const prereq: CoursePrereqNode = { type: "non_course", credits: 6 };
      const ctx = makeCtx(["CSI 2101", "MAT 1300"], 6);
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("met");
    });

    it("missing when total credits insufficient", () => {
      const prereq: CoursePrereqNode = { type: "non_course", credits: 12 };
      const ctx = makeCtx(["CSI 2101"], 3);
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("missing");
    });
  });

  describe("credits discipline constraint", () => {
    it("met when discipline credits sufficient", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        credits: 6,
        disciplines: ["CSI"],
      };
      const ctx: PrereqContext = {
        taken: [
          { code: code("CSI 1100"), credits: 3, discipline: "CSI", level: 1000 },
          { code: code("CSI 2101"), credits: 3, discipline: "CSI", level: 2000 },
        ],
        totalCredits: 6,
        disciplineCredits: { CSI: 6 },
        studentPrograms: [],
      };
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("met");
    });

    it("missing when discipline credits insufficient", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        credits: 6,
        disciplines: ["CSI"],
      };
      const ctx: PrereqContext = {
        taken: [{ code: code("CSI 1100"), credits: 3, discipline: "CSI", level: 1000 }],
        totalCredits: 3,
        disciplineCredits: { CSI: 3 },
        studentPrograms: [],
      };
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("missing");
    });
  });

  describe("credits level constraint", () => {
    it("met when level credits sufficient", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        credits: 6,
        levels: [2000],
      };
      const ctx: PrereqContext = {
        taken: [
          { code: code("CSI 2101"), credits: 3, discipline: "CSI", level: 2000 },
          { code: code("MAT 2000"), credits: 3, discipline: "MAT", level: 2000 },
        ],
        totalCredits: 6,
        disciplineCredits: { CSI: 3, MAT: 3 },
        studentPrograms: [],
      };
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("met");
    });
  });

  describe("credits disciplineLevel constraint", () => {
    it("met when discipline+level credits sufficient", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        credits: 6,
        disciplineLevels: [{ discipline: "CSI", levels: [2000, 3000] }],
      };
      const ctx: PrereqContext = {
        taken: [
          { code: code("CSI 2101"), credits: 3, discipline: "CSI", level: 2000 },
          { code: code("CSI 3100"), credits: 3, discipline: "CSI", level: 3000 },
        ],
        totalCredits: 6,
        disciplineCredits: { CSI: 6 },
        studentPrograms: [],
      };
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("met");
    });
  });

  describe("credits scoped children", () => {
    it("met when scoped children credits sufficient", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        credits: 6,
        children: [
          { type: "course", code: "ART 2120" },
          { type: "course", code: "ART 2130" },
          { type: "course", code: "ART 2140" },
        ],
      };
      const ctx: PrereqContext = {
        taken: [
          { code: code("ART 2120"), credits: 3, discipline: "ART", level: 2000 },
          { code: code("ART 2130"), credits: 3, discipline: "ART", level: 2000 },
        ],
        totalCredits: 6,
        disciplineCredits: { ART: 6 },
        studentPrograms: [],
      };
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("met");
    });

    it("missing when scoped children credits insufficient", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        credits: 6,
        children: [
          { type: "course", code: "ART 2120" },
          { type: "course", code: "ART 2130" },
          { type: "course", code: "ART 2140" },
        ],
      };
      const ctx: PrereqContext = {
        taken: [{ code: code("ART 2120"), credits: 3, discipline: "ART", level: 2000 }],
        totalCredits: 3,
        disciplineCredits: { ART: 3 },
        studentPrograms: [],
      };
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("missing");
    });
  });

  describe("programs predicate", () => {
    it("no context => unknown", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        programs: ["Computer Science"],
        children: [{ type: "course", code: "CSI 2101" }],
      };
      const graph = build("CSI 3101", prereq, null);
      const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("unknown");
      expect(gate.programs).toEqual(["Computer Science"]);
    });

    it("context with no matching program => missing", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        programs: ["Computer Science"],
        children: [{ type: "course", code: "CSI 2101" }],
      };
      const ctx = makeCtx(["CSI 2101"], undefined, ["Mathematics"]);
      const graph = build("CSI 3101", prereq, ctx);
      const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("missing");
    });

    it("context with no selected program => unknown", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        programs: ["Computer Science"],
        children: [{ type: "course", code: "CSI 2101" }],
      };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("unknown");
    });

    it("includes program qualifiers in visual and accessibility labels", () => {
      const prereq: CoursePrereqNode = {
        type: "or_group",
        programs: ["CEG", "CSI", "CTI"],
        children: [{ type: "course", code: "ITI 1120" }],
      };
      const graph = build("ITI 1121", prereq, makeCtx(["ITI 1120"]));
      const gate = graph.nodes.find((n) => n.kind === "or_gate") as PrereqGraphGateNode;

      expect(gate.label).toContain("CEG, CSI, CTI");
      expect(graph.a11yDescription).toContain("CEG, CSI, CTI");
    });

    it("applies a direct course program mismatch to visual and accessibility status", () => {
      const prereq: CoursePrereqNode = {
        type: "course",
        code: "ITI 1120",
        programs: ["CEG"],
      };
      const graph = build("ITI 1121", prereq, makeCtx(["ITI 1120"], undefined, ["Mathematics"]));
      const courseNode = graph.nodes.find(
        (node) => node.kind === "course" && node.role === "prerequisite",
      ) as PrereqGraphCourseNode;

      expect(courseNode.status).toBe("missing");
      expect(graph.a11yDescription).toContain("prereqGraph.status.missing");
    });

    it("marks an opaque program-qualified requirement missing for a known mismatch", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        kind: "permission",
        programs: ["CEG"],
      };
      const graph = build("ITI 1121", prereq, makeCtx([], undefined, ["Mathematics"]));
      const semanticNode = graph.nodes.find(
        (node) => node.kind === "semantic",
      ) as PrereqGraphSemanticNode;

      expect(semanticNode.status).toBe("missing");
      expect(
        graph.nodes.find((node) => node.kind === "course" && node.role === "target")?.status,
      ).toBe("missing");
      expect(graph.a11yDescription).toContain("prereqGraph.status.missing");
    });

    it("context with matching program continues inner evaluation", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        programs: ["Computer Science"],
        children: [{ type: "course", code: "CSI 2101" }],
      };
      const ctx = makeCtx(["CSI 2101"], undefined, ["Computer Science"]);
      const graph = build("CSI 3101", prereq, ctx);
      const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
      expect(gate.status).toBe("met");
    });

    describe("mixed high-fanout aggregation", () => {
      it("collapses mixed children while preserving their labels and statuses", () => {
        const prereq: CoursePrereqNode = {
          type: "or_group",
          children: [
            { type: "course", code: "CHG 2312", programs: ["CEG"] },
            { type: "course", code: "CHG 2313" },
            { type: "non_course", credits: 9, disciplines: ["CHG"] },
            { type: "non_course", kind: "permission" },
            {
              type: "and_group",
              children: [
                { type: "course", code: "MAT 2322" },
                { type: "course", code: "MAT 2384" },
              ],
            },
          ],
        };

        const graph = build("CHG 3331", prereq, makeCtx(["CHG 2312"], undefined, ["CEG"]));
        const aggregate = graph.nodes.find(
          (node) => node.kind === "aggregate",
        ) as PrereqGraphAggregateNode;

        expect(graph.nodes).toHaveLength(2);
        expect(aggregate.children).toHaveLength(5);
        expect(aggregate.children).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              kind: "course",
              code: code("CHG 2312"),
              status: "met",
              programLabel: expect.stringContaining("CEG"),
            }),
            expect.objectContaining({
              kind: "requirement",
              label: expect.stringContaining("prereqGraph.semantic.disciplines"),
            }),
            expect.objectContaining({
              kind: "requirement",
              label: expect.stringContaining("prereqGraph.kind.permission"),
            }),
            expect.objectContaining({
              kind: "requirement",
              label: expect.stringContaining("MAT 2322"),
            }),
          ]),
        );
      });
    });
  });

  describe("opaque non_course kinds => unknown", () => {
    const opaqueKinds: Array<CoursePrereqNode["kind"]> = [
      "permission",
      "audition",
      "language",
      "equivalent",
      "highschool",
      "standing",
      "topic",
      "coursework",
      "knowledge",
      "recommended",
    ];

    it.each(opaqueKinds)("kind %s without credits => unknown even with context", (kind) => {
      const prereq: CoursePrereqNode = { type: "non_course", kind, text: "Some requirement" };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("unknown");
    });
  });

  describe("unclassified non_course", () => {
    it("unclassified with text => unknown with disclosureText", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        text: "Must have completed an approved internship",
      };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
      expect(semantic.status).toBe("unknown");
      expect(semantic.disclosureText).toBe("Must have completed an approved internship");
    });
  });

  describe("fan-out and aggregation", () => {
    it("exactly 4 courses in or_group expands individually", () => {
      const prereq: CoursePrereqNode = {
        type: "or_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "CSI 2102" },
          { type: "course", code: "CSI 2103" },
          { type: "course", code: "CSI 2104" },
        ],
      };
      const ctx = makeCtx([]);
      const graph = build("CSI 3101", prereq, ctx);
      const courseNodes = graph.nodes.filter(
        (n) => n.kind === "course" && n.role === "prerequisite",
      );
      expect(courseNodes.length).toBe(4);
      const aggNodes = graph.nodes.filter((n) => n.kind === "aggregate");
      expect(aggNodes.length).toBe(0);
    });

    it("5 courses in or_group aggregates into any node", () => {
      const prereq: CoursePrereqNode = {
        type: "or_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "CSI 2102" },
          { type: "course", code: "CSI 2103" },
          { type: "course", code: "CSI 2104" },
          { type: "course", code: "CSI 2105" },
        ],
      };
      const ctx = makeCtx([]);
      const graph = build("CSI 3101", prereq, ctx);
      const aggNodes = graph.nodes.filter(
        (n) => n.kind === "aggregate",
      ) as PrereqGraphAggregateNode[];
      expect(aggNodes.length).toBe(1);
      expect(aggNodes[0]!.mode).toBe("any");
      expect(aggNodes[0]!.children.length).toBe(5);
    });

    it("5 courses in and_group aggregates into all node", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "CSI 2102" },
          { type: "course", code: "CSI 2103" },
          { type: "course", code: "CSI 2104" },
          { type: "course", code: "CSI 2105" },
        ],
      };
      const ctx = makeCtx(["CSI 2101", "CSI 2102"]);
      const graph = build("CSI 3101", prereq, ctx);
      const aggNodes = graph.nodes.filter(
        (n) => n.kind === "aggregate",
      ) as PrereqGraphAggregateNode[];
      expect(aggNodes.length).toBe(1);
      expect(aggNodes[0]!.mode).toBe("all");
      expect(aggNodes[0]!.children.length).toBe(5);
      // Check that children have statuses computed
      const metChildren = aggNodes[0]!.children.filter((c) => c.status === "met");
      expect(metChildren.length).toBe(2);
    });

    it("aggregate node has correct Kleene status (or, any met => met)", () => {
      const prereq: CoursePrereqNode = {
        type: "or_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "CSI 2102" },
          { type: "course", code: "CSI 2103" },
          { type: "course", code: "CSI 2104" },
          { type: "course", code: "CSI 2105" },
        ],
      };
      const ctx = makeCtx(["CSI 2103"]);
      const graph = build("CSI 3101", prereq, ctx);
      const aggNodes = graph.nodes.filter(
        (n) => n.kind === "aggregate",
      ) as PrereqGraphAggregateNode[];
      expect(aggNodes[0]!.status).toBe("met");
    });
  });

  describe("semantic labels never enumerate catalogue courses", () => {
    it("non_course with credits and disciplines produces semantic node, not expanded courses", () => {
      const prereq: CoursePrereqNode = {
        type: "non_course",
        credits: 9,
        disciplines: ["CSI"],
      };
      const courses = [makeCourse("CSI 1100"), makeCourse("CSI 2101"), makeCourse("CSI 3101")];
      const cache = makeCache(courses);
      const ctx = makeCtx(["CSI 1100"]);
      const graph = build("CSI 4100", prereq, ctx, cache);
      // Should be semantic, not expanded course nodes
      const semanticNodes = graph.nodes.filter((n) => n.kind === "semantic");
      expect(semanticNodes.length).toBe(1);
      const expandedPrereqCourses = graph.nodes.filter(
        (n) => n.kind === "course" && n.role === "prerequisite",
      );
      expect(expandedPrereqCourses.length).toBe(0);
    });
  });

  describe("deterministic IDs and topology", () => {
    it("IDs are deterministic across builds", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "MAT 1300" },
        ],
      };
      const ctx = makeCtx(["CSI 2101"]);
      const g1 = build("CSI 3101", prereq, ctx);
      const g2 = build("CSI 3101", prereq, ctx);
      expect(g1.nodes.map((n) => n.id)).toEqual(g2.nodes.map((n) => n.id));
      expect(g1.edges.map((e) => e.id)).toEqual(g2.edges.map((e) => e.id));
    });

    it("different AST paths produce different IDs", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "MAT 1300" },
        ],
      };
      const ctx = makeCtx([]);
      const graph = build("CSI 3101", prereq, ctx);
      const ids = graph.nodes.map((n) => n.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe("rank and lane metadata", () => {
    it("leaves have lowest rank, gates higher, target highest", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "MAT 1300" },
        ],
      };
      const ctx = makeCtx([]);
      const graph = build("CSI 3101", prereq, ctx);
      const leaves = graph.nodes.filter((n) => n.kind === "course" && n.role === "prerequisite");
      const gate = graph.nodes.find((n) => n.kind === "and_gate");
      const target = graph.nodes.find(
        (n) => n.kind === "course" && (n as PrereqGraphCourseNode).role === "target",
      );
      expect(leaves.length).toBe(2);
      for (const leaf of leaves) {
        expect(leaf.rank).toBeLessThan(gate!.rank);
      }
      expect(gate!.rank).toBeLessThan(target!.rank);
    });

    it("leaves have sequential lanes, gate averages", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "MAT 1300" },
        ],
      };
      const ctx = makeCtx([]);
      const graph = build("CSI 3101", prereq, ctx);
      const leaves = graph.nodes
        .filter((n) => n.kind === "course" && (n as PrereqGraphCourseNode).role === "prerequisite")
        .sort((a, b) => a.lane - b.lane);
      expect(leaves[0]!.lane).toBe(0);
      expect(leaves[1]!.lane).toBe(1);
      const gate = graph.nodes.find((n) => n.kind === "and_gate");
      expect(gate!.lane).toBe(0.5);
    });

    it("rankCount and laneCount are accurate", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "MAT 1300" },
        ],
      };
      const ctx = makeCtx([]);
      const graph = build("CSI 3101", prereq, ctx);
      // leaves at rank 0, gate at rank 1, target at rank 2 => 3 ranks
      expect(graph.rankCount).toBe(3);
      // 2 lanes for the 2 leaf nodes
      expect(graph.laneCount).toBe(2);
    });
  });

  describe("a11y description", () => {
    it("preserves Boolean structure in description", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          { type: "course", code: "MAT 1300" },
        ],
      };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      expect(graph.a11yDescription).toBeTruthy();
      expect(typeof graph.a11yDescription).toBe("string");
      // Should contain some structural info
      expect(graph.a11yDescription.length).toBeGreaterThan(0);
    });

    it("includes status information", () => {
      const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      expect(graph.a11yDescription).toContain("prereqGraph.status.met");
    });

    it.each([
      ["met", makeCtx(["CSI 2101"])] as [string, PrereqContext | null],
      ["missing", makeCtx([])] as [string, PrereqContext | null],
      ["unknown", null] as [string, PrereqContext | null],
    ])("status=%s routes through the literal tr id prereqGraph.status.%s", (status, ctx) => {
      const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };
      const graph = build("CSI 3101", prereq, ctx);
      // mockTr returns the id as-is; when used as a value the outer call produces
      // "id(key=value)" — so status appears as "status=prereqGraph.status.<X>"
      expect(graph.a11yDescription).toContain(`prereqGraph.status.${status}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: a11y vs visual status parity (Bug 1 + Bug 2)
  // ---------------------------------------------------------------------------

  describe("a11y vs visual status parity", () => {
    describe("Bug 1: gate node programs predicate is reflected in a11y status", () => {
      it("AND gate: child taken but student program mismatches => a11y reports missing, consistent with visual", () => {
        const prereq: CoursePrereqNode = {
          type: "and_group",
          programs: ["Computer Science"],
          children: [{ type: "course", code: "CSI 2101" }],
        };
        const ctx = makeCtx(["CSI 2101"], undefined, ["Mathematics"]);
        const graph = build("CSI 3101", prereq, ctx);

        // Visual gate must be missing (program mismatch overrides met child)
        const gate = graph.nodes.find((n) => n.kind === "and_gate") as PrereqGraphGateNode;
        expect(gate.status).toBe("missing");

        // a11y must agree: the outer gate status embedded in the description is "missing"
        expect(graph.a11yDescription).toContain("status=prereqGraph.status.missing");
      });

      it("OR gate: child taken but student program mismatches => a11y reports missing, consistent with visual", () => {
        const prereq: CoursePrereqNode = {
          type: "or_group",
          programs: ["Computer Science"],
          children: [{ type: "course", code: "CSI 2101" }],
        };
        const ctx = makeCtx(["CSI 2101"], undefined, ["Mathematics"]);
        const graph = build("CSI 3101", prereq, ctx);

        const gate = graph.nodes.find((n) => n.kind === "or_gate") as PrereqGraphGateNode;
        expect(gate.status).toBe("missing");

        expect(graph.a11yDescription).toContain("status=prereqGraph.status.missing");
      });
    });

    describe("Bug 2: non_course credit nodes use credit evaluation in a11y", () => {
      it("total credits met: a11y and visual both report met", () => {
        const prereq: CoursePrereqNode = { type: "non_course", credits: 6 };
        const ctx = makeCtx(["CSI 2101", "MAT 1300"], 6);
        const graph = build("CSI 3101", prereq, ctx);

        const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
        expect(semantic.status).toBe("met");
        expect(graph.a11yDescription).toContain("status=prereqGraph.status.met");
      });

      it("total credits missing: a11y and visual both report missing", () => {
        const prereq: CoursePrereqNode = { type: "non_course", credits: 12 };
        const ctx = makeCtx(["CSI 2101"], 3);
        const graph = build("CSI 3101", prereq, ctx);

        const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
        expect(semantic.status).toBe("missing");
        expect(graph.a11yDescription).toContain("status=prereqGraph.status.missing");
      });

      it("discipline credits met: a11y and visual both report met", () => {
        const prereq: CoursePrereqNode = { type: "non_course", credits: 6, disciplines: ["CSI"] };
        const ctx: PrereqContext = {
          taken: [
            { code: code("CSI 1100"), credits: 3, discipline: "CSI", level: 1000 },
            { code: code("CSI 2101"), credits: 3, discipline: "CSI", level: 2000 },
          ],
          totalCredits: 6,
          disciplineCredits: { CSI: 6 },
          studentPrograms: [],
        };
        const graph = build("CSI 3101", prereq, ctx);

        const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
        expect(semantic.status).toBe("met");
        expect(graph.a11yDescription).toContain("status=prereqGraph.status.met");
      });

      it("discipline credits missing: a11y and visual both report missing", () => {
        const prereq: CoursePrereqNode = { type: "non_course", credits: 9, disciplines: ["CSI"] };
        const ctx: PrereqContext = {
          taken: [{ code: code("CSI 2101"), credits: 3, discipline: "CSI", level: 2000 }],
          totalCredits: 3,
          disciplineCredits: { CSI: 3 },
          studentPrograms: [],
        };
        const graph = build("CSI 3101", prereq, ctx);

        const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
        expect(semantic.status).toBe("missing");
        expect(graph.a11yDescription).toContain("status=prereqGraph.status.missing");
      });

      it("scoped children credits met: a11y and visual both report met", () => {
        const prereq: CoursePrereqNode = {
          type: "non_course",
          credits: 6,
          children: [
            { type: "course", code: "ART 2120" },
            { type: "course", code: "ART 2130" },
          ],
        };
        const ctx: PrereqContext = {
          taken: [
            { code: code("ART 2120"), credits: 3, discipline: "ART", level: 2000 },
            { code: code("ART 2130"), credits: 3, discipline: "ART", level: 2000 },
          ],
          totalCredits: 6,
          disciplineCredits: { ART: 6 },
          studentPrograms: [],
        };
        const graph = build("CSI 3101", prereq, ctx);

        const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
        expect(semantic.status).toBe("met");
        expect(graph.a11yDescription).toContain("status=prereqGraph.status.met");
      });

      it("opaque kind (no credits) stays unknown in both visual and a11y", () => {
        const prereq: CoursePrereqNode = {
          type: "non_course",
          kind: "permission",
          text: "Instructor approval required",
        };
        const ctx = makeCtx(["CSI 2101"]);
        const graph = build("CSI 3101", prereq, ctx);

        const semantic = graph.nodes.find((n) => n.kind === "semantic") as PrereqGraphSemanticNode;
        expect(semantic.status).toBe("unknown");
        expect(graph.a11yDescription).toContain("status=prereqGraph.status.unknown");
      });
    });
  });

  describe("cache usage does not crash on missing courses", () => {
    it("handles cache returning undefined gracefully", () => {
      const cache = makeCache([]);
      const prereq: CoursePrereqNode = { type: "course", code: "MISSING 9999" };
      const ctx = makeCtx([]);
      // Should not throw
      const graph = build("CSI 3101", prereq, ctx, cache);
      expect(graph.nodes.length).toBeGreaterThan(0);
    });
  });

  describe("single prerequisite course (no gate)", () => {
    it("produces target, prerequisite, and edge without gate", () => {
      const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      // Should have target and prerequisite course nodes
      const target = graph.nodes.find(
        (n) => n.kind === "course" && (n as PrereqGraphCourseNode).role === "target",
      );
      const prereqNode = graph.nodes.find(
        (n) => n.kind === "course" && (n as PrereqGraphCourseNode).role === "prerequisite",
      );
      expect(target).toBeDefined();
      expect(prereqNode).toBeDefined();
      // At least one edge connecting prereq to target
      expect(graph.edges.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("graph structure", () => {
    it("rootId references a valid node", () => {
      const prereq: CoursePrereqNode = { type: "course", code: "CSI 2101" };
      const graph = build("CSI 3101", prereq, null);
      const rootNode = graph.nodes.find((n) => n.id === graph.rootId);
      expect(rootNode).toBeDefined();
    });

    it("all edge sourceId and targetId reference valid nodes", () => {
      const prereq: CoursePrereqNode = {
        type: "and_group",
        children: [
          { type: "course", code: "CSI 2101" },
          {
            type: "or_group",
            children: [
              { type: "course", code: "MAT 1300" },
              { type: "course", code: "MAT 1700" },
            ],
          },
        ],
      };
      const ctx = makeCtx(["CSI 2101"]);
      const graph = build("CSI 3101", prereq, ctx);
      const nodeIds = new Set(graph.nodes.map((n) => n.id));
      for (const edge of graph.edges) {
        expect(nodeIds.has(edge.sourceId)).toBe(true);
        expect(nodeIds.has(edge.targetId)).toBe(true);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Regression: a11y kind-label translator IDs use only literal expected IDs
  // ---------------------------------------------------------------------------

  describe("a11y kind-label translator IDs: only literal expected IDs are requested", () => {
    const ALL_KINDS: CoursePrereqKind[] = [
      "permission",
      "audition",
      "language",
      "equivalent",
      "highschool",
      "standing",
      "topic",
      "coursework",
      "knowledge",
      "recommended",
    ];

    // All legal kind-label tr IDs (explicit literals in buildSemanticLabel)
    const ALLOWED_KIND_IDS = new Set([
      ...ALL_KINDS.map((k) => `prereqGraph.kind.${k}`),
      "prereqGraph.kind.unclassified",
    ]);

    it.each(ALL_KINDS)("kind=%s: a11y calls prereqGraph.kind.%s and no other kind IDs", (kind) => {
      const calledIds: string[] = [];
      const trackingTr: PrereqGraphTr = (id, values) => {
        calledIds.push(id);
        if (!values || Object.keys(values).length === 0) return id;
        const parts = Object.entries(values).map(([k, v]) => `${k}=${v}`);
        return `${id}(${parts.join(", ")})`;
      };

      const prereq: CoursePrereqNode = { type: "non_course", kind, text: "Some requirement" };
      buildPrereqGraph({
        courseCode: code("CSI 3101"),
        prereqRoot: prereq,
        plannerContext: makeCtx([]),
        cache: null,
        tr: trackingTr,
      });

      // The expected literal ID must have been called
      expect(calledIds).toContain(`prereqGraph.kind.${kind}`);

      // Every kind-prefixed ID that was called must be from the known literal set
      const kindIds = calledIds.filter((id) => id.startsWith("prereqGraph.kind."));
      for (const id of kindIds) {
        expect(ALLOWED_KIND_IDS.has(id)).toBe(true);
      }
    });

    it("unclassified non_course calls prereqGraph.kind.unclassified and no other kind IDs", () => {
      const calledIds: string[] = [];
      const trackingTr: PrereqGraphTr = (id, values) => {
        calledIds.push(id);
        if (!values || Object.keys(values).length === 0) return id;
        const parts = Object.entries(values).map(([k, v]) => `${k}=${v}`);
        return `${id}(${parts.join(", ")})`;
      };

      const prereq: CoursePrereqNode = { type: "non_course", text: "Some requirement" };
      buildPrereqGraph({
        courseCode: code("CSI 3101"),
        prereqRoot: prereq,
        plannerContext: makeCtx([]),
        cache: null,
        tr: trackingTr,
      });

      expect(calledIds).toContain("prereqGraph.kind.unclassified");

      const kindIds = calledIds.filter((id) => id.startsWith("prereqGraph.kind."));
      for (const id of kindIds) {
        expect(ALLOWED_KIND_IDS.has(id)).toBe(true);
      }
    });
  });
});
