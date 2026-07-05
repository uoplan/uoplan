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
    // Two extra courses that both hang off CSI 2110, to exercise edge deduping.
    {
      code: normalizeCourseCode("CSI 2101"),
      title: "Extra A",
      credits: 3,
      description: "",
      component: "LEC",
      prerequisites: courseNode("CSI 2110"),
    },
    {
      code: normalizeCourseCode("CSI 2102"),
      title: "Extra B",
      credits: 3,
      description: "",
      component: "LEC",
      prerequisites: courseNode("CSI 2110"),
    },
  ],
};

const cache = buildDataCache(catalogue, emptySchedules);

const completedTerms: TranscriptTerm[] = [
  { label: "Fall 2023", year: 2023, season: "Fall", courses: ["CSI 2110"] },
  { label: "Winter 2024", year: 2024, season: "Winter", courses: ["CSI 2120"] },
];

/** Node id → readable label: `completed::CSI 2110` → `CSI 2110`, `container-future-2265` → `term:2265`. */
function label(nodeId: string): string {
  if (nodeId.startsWith("container-future-")) {
    return `term:${nodeId.slice("container-future-".length)}`;
  }
  return nodeId.split("::")[1] ?? nodeId;
}

function edgePairs(edges: { source: string; target: string }[]): string[] {
  return edges.map((e) => `${label(e.source)}->${label(e.target)}`);
}

describe("buildPlannerGraph", () => {
  it("renders one background block per completed term plus a calendar node per future term", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache,
    });

    // Two completed term blocks + one future-term calendar container.
    expect(graph.bandNodes).toHaveLength(3);
    // Future terms no longer emit child course nodes; only completed chips remain.
    expect(graph.courseNodes).toHaveLength(2);
    expect(graph.courseNodes.every((n) => n.data.status === "completed")).toBe(true);
    const [fallBand, winterBand, futureBand] = graph.bandNodes;
    expect(fallBand?.data.label).toBe("Fall 2023");
    expect(winterBand?.data.label).toBe("Winter 2024");
    expect(futureBand?.type).toBe("futureTerm");
    // Completed blocks sit left→right chronologically, before the future term.
    expect(fallBand?.position.x).toBeLessThan(winterBand?.position.x ?? 0);
    expect(winterBand?.position.x).toBeLessThan(futureBand?.position.x ?? 0);
  });

  it("tags each completed course with the term it was taken in", () => {
    const graph = buildPlannerGraph({ completedTerms, futureTerms: [], cache });

    expect(graph.courseNodes.find((n) => n.data.code === "CSI 2110")?.data.term).toBe("Fall 2023");
    expect(graph.courseNodes.find((n) => n.data.code === "CSI 2120")?.data.term).toBe(
      "Winter 2024",
    );
  });

  it("draws prerequisite edges between completed courses in chronological order", () => {
    const graph = buildPlannerGraph({ completedTerms, futureTerms: [], cache });

    // CSI 2110 (Fall) is a prereq of CSI 2120 (Winter): edge points forward.
    expect(edgePairs(graph.edges)).toContain("CSI 2110->CSI 2120");
  });

  it("routes prerequisite in-edges into a future term's calendar node", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache,
    });

    // CSI 3105 (planned) needs CSI 2120 (completed): the edge lands on the term's calendar node.
    expect(edgePairs(graph.edges)).toContain("CSI 2120->term:2265");
  });

  it("links an earlier planned term's calendar into a later term that needs it", () => {
    const graph = buildPlannerGraph({
      completedTerms: [{ label: "Fall 2023", year: 2023, season: "Fall", courses: ["CSI 2110"] }],
      futureTerms: [
        { termId: "2255", label: "Winter 2026", enabled: true, courses: ["CSI 2120"] },
        { termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] },
      ],
      cache,
    });

    const pairs = edgePairs(graph.edges);
    // CSI 2120 is provided by the earlier planned term 2255; CSI 3105 (in 2265) needs it.
    expect(pairs).toContain("term:2255->term:2265");
    // CSI 2120's own prereq CSI 2110 is completed and links into term 2255.
    expect(pairs).toContain("CSI 2110->term:2255");
  });

  it("dedupes prerequisite edges shared by multiple courses in a term", () => {
    const graph = buildPlannerGraph({
      completedTerms: [{ label: "Fall 2023", year: 2023, season: "Fall", courses: ["CSI 2110"] }],
      // Both planned courses depend on the completed CSI 2110.
      futureTerms: [
        { termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 2101", "CSI 2102"] },
      ],
      cache,
    });

    const into2265 = edgePairs(graph.edges).filter((p) => p === "CSI 2110->term:2265");
    expect(into2265).toHaveLength(1);
  });

  it("never links a course to its own term (same-term prereqs draw no edge)", () => {
    const graph = buildPlannerGraph({
      completedTerms: [],
      // CSI 3105 needs CSI 2120; both scheduled in the same term.
      futureTerms: [
        { termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 2120", "CSI 3105"] },
      ],
      cache,
    });

    expect(edgePairs(graph.edges)).not.toContain("term:2265->term:2265");
  });

  it("sizes enabled future terms taller than disabled ones", () => {
    const enabled = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: [] }],
      cache,
    });
    const disabled = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: false, courses: [] }],
      cache,
    });

    const enabledBand = enabled.bandNodes.find((b) => b.type === "futureTerm");
    const disabledBand = disabled.bandNodes.find((b) => b.type === "futureTerm");
    expect(enabledBand?.height ?? 0).toBeGreaterThan(disabledBand?.height ?? 0);
  });

  it("marks completed courses as completed", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache,
    });

    expect(graph.courseNodes.find((n) => n.data.code === "CSI 2110")?.data.status).toBe(
      "completed",
    );
  });

  it("never flags completed courses as missing a prerequisite", () => {
    // CSI 2120 requires CSI 2110, but here it sits alone in the first completed
    // term with no prior course. Because it's completed (historical fact), it
    // must stay "completed".
    const graph = buildPlannerGraph({
      completedTerms: [{ label: "Fall 2023", year: 2023, season: "Fall", courses: ["CSI 2120"] }],
      futureTerms: [],
      cache,
    });

    expect(graph.courseNodes.find((n) => n.data.code === "CSI 2120")?.data.status).toBe(
      "completed",
    );
  });

  it("handles a null cache without throwing", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: ["CSI 3105"] }],
      cache: null,
    });
    // Only completed chips; no edges without a cache to read prerequisites from.
    expect(graph.courseNodes).toHaveLength(2);
    expect(graph.edges).toHaveLength(0);
  });

  it("renders completed blocks as passive labels and future terms as draggable containers", () => {
    const graph = buildPlannerGraph({
      completedTerms,
      futureTerms: [{ termId: "2265", label: "Summer 2026", enabled: true, courses: [] }],
      cache,
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
      positions: { "completed::CSI 2110": { x: 999, y: 42 } },
    });

    const moved = graph.courseNodes.find((n) => n.data.code === "CSI 2110");
    expect(moved?.position).toEqual({ x: 999, y: 42 });
  });
});
