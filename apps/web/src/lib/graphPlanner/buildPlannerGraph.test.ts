import { describe, expect, it } from "vitest";
import { buildDataCache, normalizeCourseCode } from "@uoplan/core";
import type { Catalogue, SchedulesData } from "@uoplan/core";
import type { TranscriptTerm } from "@uoplan/core/transcript";
import { buildPlannerGraph } from "./buildPlannerGraph";

const emptySchedules: SchedulesData = { termId: "2265", schedules: [] };

function courseNode(code: string) {
  return { type: "course" as const, code: normalizeCourseCode(code) };
}

const catalogue: Catalogue = {
  programs: [],
  courses: [
    {
      code: normalizeCourseCode("CSI 2110"),
      title: "Data Structures",
      credits: 3,
      description: "",
      component: "LEC",
    },
    {
      code: normalizeCourseCode("CSI 2120"),
      title: "Programming Paradigms",
      credits: 3,
      description: "",
      component: "LEC",
      prerequisites: courseNode("CSI 2110"),
    },
    {
      code: normalizeCourseCode("CSI 3105"),
      title: "Algorithms",
      credits: 3,
      description: "",
      component: "LEC",
      prerequisites: courseNode("CSI 2120"),
    },
  ],
};

const cache = buildDataCache(catalogue, emptySchedules);

const completedTerms: TranscriptTerm[] = [
  { label: "Fall 2023", year: 2023, season: "Fall", courses: ["CSI 2110"] },
  { label: "Winter 2024", year: 2024, season: "Winter", courses: ["CSI 2120"] },
];

describe("buildPlannerGraph", () => {
  it("renders one background block per completed term plus a container per future term", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache,
      studentPrograms: [],
    });

    // Two completed term blocks + one future-term container.
    expect(graph.bandNodes).toHaveLength(3);
    expect(graph.courseNodes).toHaveLength(3);
    const [fallBand, winterBand, futureBand] = graph.bandNodes;
    expect(fallBand?.data.label).toBe("Fall 2023");
    expect(winterBand?.data.label).toBe("Winter 2024");
    // Completed blocks sit left→right chronologically, before the future term.
    expect(fallBand?.position.x).toBeLessThan(winterBand?.position.x ?? 0);
    expect(winterBand?.position.x).toBeLessThan(futureBand?.position.x ?? 0);
  });

  it("tags each completed course with the term it was taken in", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [],
      cache,
      studentPrograms: [],
    });

    expect(graph.courseNodes.find((n) => n.data.code === "CSI 2110")?.data.term).toBe("Fall 2023");
    expect(graph.courseNodes.find((n) => n.data.code === "CSI 2120")?.data.term).toBe(
      "Winter 2024",
    );
  });

  it("draws prerequisite edges between courses in chronological order", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache,
      studentPrograms: [],
    });

    const pairs = graph.edges.map((e) => `${sourceCode(e.source)}->${sourceCode(e.target)}`);
    // A prereq points into the course that needs it, completed or planned.
    expect(pairs).toContain("CSI 2110->CSI 2120");
    expect(pairs).toContain("CSI 2120->CSI 3105");
  });

  it("flags a planned course whose prerequisite isn't scheduled earlier", () => {
    const graph = buildPlannerGraph({
      completedTerms: [],
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache,
      studentPrograms: [],
    });

    const node = graph.courseNodes.find((n) => n.data.code === "CSI 3105");
    expect(node?.data.status).toBe("missingPrereq");
  });

  it("marks completed courses as completed and satisfied planned courses as planned", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache,
      studentPrograms: [],
    });

    expect(graph.courseNodes.find((n) => n.data.code === "CSI 2110")?.data.status).toBe(
      "completed",
    );
    expect(graph.courseNodes.find((n) => n.data.code === "CSI 3105")?.data.status).toBe("planned");
  });

  it("never flags completed courses as missing a prerequisite", () => {
    // CSI 2120 requires CSI 2110, but here it sits alone in the first completed
    // term with no prior course. Because it's completed (historical fact), it
    // must stay "completed" rather than being flagged missing-prereq.
    const graph = buildPlannerGraph({
      completedTerms: [{ label: "Fall 2023", year: 2023, season: "Fall", courses: ["CSI 2120"] }],
      futureTerms: [],
      cache,
      studentPrograms: [],
    });

    expect(graph.courseNodes.find((n) => n.data.code === "CSI 2120")?.data.status).toBe(
      "completed",
    );
  });

  it("handles a null cache without throwing", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [],
      cache: null,
      studentPrograms: [],
    });
    expect(graph.courseNodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(0);
  });

  it("makes completed courses free top-level nodes and future courses container children", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache,
      studentPrograms: [],
    });

    const completed = graph.courseNodes.find((n) => n.data.code === "CSI 2110");
    expect(completed?.draggable).toBe(true);
    expect(completed?.parentId).toBeUndefined();

    const future = graph.courseNodes.find((n) => n.data.code === "CSI 3105");
    expect(future?.draggable).toBe(true);
    expect(future?.extent).toBe("parent");
    expect(future?.parentId).toBe("container-future-2265");
  });

  it("renders completed blocks as passive labels and future terms as draggable containers", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: [] }],
      cache,
      studentPrograms: [],
    });

    const completedBands = graph.bandNodes.filter((b) => b.type === "termBand");
    const futureBands = graph.bandNodes.filter((b) => b.type === "futureTerm");
    // One passive block per completed term.
    expect(completedBands).toHaveLength(2);
    expect(completedBands.every((b) => b.draggable === false)).toBe(true);
    expect(futureBands).toHaveLength(1);
    expect(futureBands[0]?.draggable).toBe(true);
  });

  it("applies saved positions over the automatic layout", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [],
      cache,
      studentPrograms: [],
      positions: { "completed::CSI 2110": { x: 999, y: 42 } },
    });

    const moved = graph.courseNodes.find((n) => n.data.code === "CSI 2110");
    expect(moved?.position).toEqual({ x: 999, y: 42 });
  });
});

/** Node id is `${prefix}::${canonicalCode}`; pull the code back out for readable asserts. */
function sourceCode(nodeId: string): string {
  return nodeId.split("::")[1] ?? nodeId;
}
