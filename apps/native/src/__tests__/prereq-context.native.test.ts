/**
 * Focused tests for useNativePrereqGraphContext program-derived studentPrograms.
 *
 * These tests prove that when a program is selected:
 * - Its discipline codes are passed as studentPrograms to buildPrereqContext
 * - Program-gated AST nodes resolve correctly (met / missing / unknown)
 */
import { cleanup, renderHook } from "@testing-library/react-native";

import { buildPrereqGraph, normalizeCourseCode } from "@uoplan/core";
import type { Catalogue, CoursePrereqNode, Program } from "@uoplan/core/dataTypes";

import { useNativePrereqGraphContext } from "@/lib/use-basket-status";

// ---------------------------------------------------------------------------
// Module-level mocks
// ---------------------------------------------------------------------------

const mockUseAppData = jest.fn();
const mockUseScheduleOptions = jest.fn();
const mockUseCompletedCourses = jest.fn();

jest.mock("@/data/data-provider", () => ({
  useAppData: () => mockUseAppData(),
  useFeedback: () => ({}),
}));

jest.mock("@/data/schedule-options-provider", () => ({
  useScheduleOptions: () => mockUseScheduleOptions(),
}));

jest.mock("@/data/completed-courses-provider", () => ({
  useCompletedCourses: () => mockUseCompletedCourses(),
}));

// basket-provider is imported by the module but not called by this hook
jest.mock("@/data/basket-provider", () => ({
  useBasket: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CS_PROGRAM_URL = "https://example.com/cs";
const MATH_PROGRAM_URL = "https://example.com/math";

/** CS program — getDisciplineCodesForProgram yields ["CSI"] */
const csProgram: Program = {
  title: "Computer Science",
  url: CS_PROGRAM_URL,
  requirements: [{ type: "course", code: "CSI 2101", credits: 3 }],
};

/** Math program — getDisciplineCodesForProgram yields ["MAT"] */
const mathProgram: Program = {
  title: "Mathematics",
  url: MATH_PROGRAM_URL,
  requirements: [{ type: "course", code: "MAT 1320", credits: 3 }],
};

const catalogue: Catalogue = {
  programs: [csProgram, mathProgram],
  courses: [
    {
      code: normalizeCourseCode("CSI 2101"),
      title: "Data Structures",
      credits: 3,
      description: "",
    },
    { code: normalizeCourseCode("MAT 1320"), title: "Calculus I", credits: 3, description: "" },
  ],
};

/** AND-gate gated to the "CSI" discipline program, with a single course child. */
const csiProgramGatedPrereq: CoursePrereqNode = {
  type: "and_group",
  programs: ["CSI"],
  children: [{ type: "course", code: "CSI 2101" }],
};

const mockTr = (id: string) => id;

function setMocks(options: {
  programUrl: string | null;
  startYear?: string | null;
  completedCodes: string[];
}) {
  mockUseAppData.mockReturnValue({
    bundle: {
      catalogue,
      disciplines: [],
      faculties: [],
      terms: [],
    },
    schedulesByTerm: new Map(),
  });
  mockUseScheduleOptions.mockReturnValue({
    personalization: {
      termId: null,
      programUrl: options.programUrl,
      startYear: options.startYear ?? null,
    },
  });
  mockUseCompletedCourses.mockReturnValue({ codes: options.completedCodes });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("useNativePrereqGraphContext — program-gated node status", () => {
  beforeEach(() => jest.clearAllMocks());
  afterEach(cleanup);

  it("selected program whose derived codes include the gated discipline + child met → gate is met", async () => {
    setMocks({ programUrl: CS_PROGRAM_URL, completedCodes: ["CSI 2101"] });

    const { result } = await renderHook(() => useNativePrereqGraphContext());
    const { plannerContext, cache } = result.current;

    expect(plannerContext).not.toBeNull();
    expect(plannerContext?.studentPrograms).toContain("CSI");

    const graph = buildPrereqGraph({
      courseCode: normalizeCourseCode("CSI 3101"),
      prereqRoot: csiProgramGatedPrereq,
      plannerContext,
      cache,
      tr: mockTr,
    });

    const gate = graph.nodes.find((n) => n.kind === "and_gate");
    expect(gate?.status).toBe("met");
  });

  it("selected program whose derived codes do NOT include the gated discipline → gate is missing", async () => {
    // Math program yields ["MAT"], not ["CSI"] — node.programs = ["CSI"] is unsatisfied
    setMocks({ programUrl: MATH_PROGRAM_URL, completedCodes: ["CSI 2101"] });

    const { result } = await renderHook(() => useNativePrereqGraphContext());
    const { plannerContext, cache } = result.current;

    expect(plannerContext).not.toBeNull();
    expect(plannerContext?.studentPrograms).not.toContain("CSI");

    const graph = buildPrereqGraph({
      courseCode: normalizeCourseCode("CSI 3101"),
      prereqRoot: csiProgramGatedPrereq,
      plannerContext,
      cache,
      tr: mockTr,
    });

    const gate = graph.nodes.find((n) => n.kind === "and_gate");
    expect(gate?.status).toBe("missing");
  });

  it("no program or profile context → plannerContext is null → gate is unknown", async () => {
    setMocks({ programUrl: null, startYear: null, completedCodes: [] });

    const { result } = await renderHook(() => useNativePrereqGraphContext());

    expect(result.current.plannerContext).toBeNull();

    const graph = buildPrereqGraph({
      courseCode: normalizeCourseCode("CSI 3101"),
      prereqRoot: csiProgramGatedPrereq,
      plannerContext: null,
      cache: result.current.cache,
      tr: mockTr,
    });

    const gate = graph.nodes.find((n) => n.kind === "and_gate");
    expect(gate?.status).toBe("unknown");
  });
});
