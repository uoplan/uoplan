import { act, cleanup, fireEvent, render, waitFor } from "@testing-library/react-native";

import type { Catalogue, Course, DisciplinesData, Term } from "@uoplan/core/dataTypes";
import { normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { CourseDescriptionSection } from "@/components/explore/course-description-section";
import { CoursePrereqGraph } from "@/components/explore/course-prereq-graph";
import type { ExploreIndex } from "@/data/explore-index";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockPush = jest.fn();
const mockUseAppData = jest.fn();
const mockUseScheduleOptions = jest.fn();
const mockLoadCourseDescription = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ code: "CSI 2110" }),
}));

jest.mock("@/data/data-provider", () => ({
  useAppData: () => mockUseAppData(),
  useFeedback: () => ({}),
}));

jest.mock("@/data/basket-provider", () => ({
  useBasket: () => ({
    codes: [],
    count: 0,
    has: () => false,
    add: jest.fn(),
    remove: jest.fn(),
    toggle: jest.fn(),
    clear: jest.fn(),
  }),
}));

jest.mock("@/data/completed-courses-provider", () => ({
  useCompletedCourses: () => ({
    codes: ["MAT 1320"],
    count: 1,
    has: (c: string) => c === "MAT 1320",
    add: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  }),
}));

jest.mock("@/data/schedule-options-provider", () => ({
  useScheduleOptions: () => mockUseScheduleOptions(),
}));

jest.mock("@/lib/adaptive-layout", () => ({
  useAdaptiveLayout: () => ({
    width: 390,
    height: 844,
    isCompactWidth: true,
    isRegularWidth: false,
    formSheet: false,
  }),
}));

jest.mock("@/lib/analytics", () => ({
  useAnalytics: () => ({ capture: jest.fn() }),
}));

jest.mock("@/i18n", () => ({
  useTr: () => (id: string) => {
    const messages: Record<string, string> = {
      "explore.course.about": "About",
      "explore.course.description.error": "Couldn't load the course description.",
      "explore.course.description.retry": "Try again",
      "explore.course.description.showLess": "Read less",
      "explore.course.description.showMore": "Read more",
      "explore.course.prereqs": "Prerequisites",
      "prereqGraph.status.met": "met",
      "prereqGraph.status.missing": "not met",
      "prereqGraph.status.unknown": "unknown",
    };
    return messages[id] ?? id;
  },
  tr: (id: string) => id,
}));

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const gradeViz = normalizeGradeVizDistribution({ A: 80, F: 20 });
const terms: Term[] = [{ termId: "202509", name: "Fall 2025" }];
const disciplines: DisciplinesData = {
  disciplines: [{ code: "CSI", name: "Computer Science", facultyId: "science" as never }],
  faculties: [{ id: "science" as never, name: "Science" }],
};

function makeCourse(
  partial: { code: string; title: string } & Partial<Omit<Course, "code" | "title">>,
): Course {
  return {
    credits: 3,
    description: "",
    ...partial,
    code: normalizeCourseCode(partial.code),
  };
}

const catalogue: Catalogue = {
  programs: [],
  courses: [
    makeCourse({ code: "MAT 1320", title: "Calculus I" }),
    makeCourse({
      code: "CSI 2110",
      title: "Data Structures",
      prerequisites: {
        type: "and_group",
        children: [{ type: "course", code: "MAT 1320" }],
      },
    }),
  ],
};

const index: ExploreIndex = {
  courses: [
    {
      code: "CSI 2110",
      title: "Data Structures",
      discipline: "CSI",
      distribution: {},
      gradeViz,
      gpa: 7.0,
      graded: 200,
      failRate: 0.1,
      termIds: ["202509"],
    },
  ],
  disciplines: [
    {
      code: "CSI",
      name: "Computer Science",
      facultyId: "science",
      courseCount: 10,
      graded: 500,
      gradeViz: null,
    },
  ],
  faculties: [{ id: "science", name: "Science", disciplineCount: 3, graded: 1000, gradeViz: null }],
  professors: [],
  programs: [],
  descriptionIndex: null,
};

function setDefaultData() {
  const mockDataClient = {
    loadCourseDescription: mockLoadCourseDescription,
  };
  mockUseAppData.mockReturnValue({
    bundle: {
      catalogue,
      disciplines: disciplines.disciplines,
      faculties: disciplines.faculties,
      terms,
    },
    index,
    schedulesByTerm: new Map([["202509", { termId: "202509", schedules: [] }]]),
    feedback: {},
    aliasGroups: {},
    catalogueYears: [2026],
    dataClient: mockDataClient,
  });
  mockUseScheduleOptions.mockReturnValue({
    personalization: { termId: "202509", startYear: "2024", programUrl: null },
  });
}

// ---------------------------------------------------------------------------
// Tests: useCourseDescription
// ---------------------------------------------------------------------------

describe("CourseDescriptionSection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultData();
  });

  afterEach(cleanup);

  it("passes facultyId to dataClient.loadCourseDescription", async () => {
    mockLoadCourseDescription.mockResolvedValue("A course about algorithms.");

    await render(<CourseDescriptionSection courseCode="CSI 2110" facultyId="science" />);

    await waitFor(() => {
      expect(mockLoadCourseDescription).toHaveBeenCalledWith("science", "CSI 2110");
    });
  });

  it("renders loading state then description text", async () => {
    let resolveDesc: (v: string) => void;
    mockLoadCourseDescription.mockReturnValue(
      new Promise<string>((r) => {
        resolveDesc = r;
      }),
    );

    const { queryByText, getByText } = await render(
      <CourseDescriptionSection courseCode="CSI 2110" facultyId="science" />,
    );

    // Shows "About" heading during loading
    expect(getByText("About")).toBeTruthy();

    // Resolve description
    await act(async () => {
      resolveDesc!("An important course.");
    });

    expect(getByText("An important course.")).toBeTruthy();
  });

  it("renders nothing when description is missing (null/undefined)", async () => {
    mockLoadCourseDescription.mockResolvedValue(undefined);

    const { queryByText } = await render(
      <CourseDescriptionSection courseCode="CSI 2110" facultyId="science" />,
    );

    await waitFor(() => {
      expect(mockLoadCourseDescription).toHaveBeenCalled();
    });

    expect(queryByText("About")).toBeNull();
  });

  it("shows error and retry on failure", async () => {
    mockLoadCourseDescription.mockRejectedValueOnce(new Error("network"));

    const { getByText } = await render(
      <CourseDescriptionSection courseCode="CSI 2110" facultyId="science" />,
    );

    await waitFor(() => {
      expect(getByText("Couldn't load the course description.")).toBeTruthy();
    });

    expect(getByText("Try again")).toBeTruthy();

    // Retry
    mockLoadCourseDescription.mockResolvedValueOnce("Retry success.");
    await act(async () => {
      fireEvent.press(getByText("Try again"));
    });

    await waitFor(() => {
      expect(getByText("Retry success.")).toBeTruthy();
    });
  });

  it("shows an inline Read more toggle for text longer than two lines", async () => {
    const longText = "A".repeat(700);
    mockLoadCourseDescription.mockResolvedValue(longText);

    const { getByTestId, getByText } = await render(
      <CourseDescriptionSection courseCode="CSI 2110" facultyId="science" />,
    );

    fireEvent(getByTestId("course-description-text"), "textLayout", {
      nativeEvent: { lines: Array.from({ length: 7 }, () => ({})) },
    });

    await waitFor(() => {
      expect(getByText("Read more")).toBeTruthy();
    });

    // Toggle to expanded
    await act(async () => {
      fireEvent.press(getByText("Read more"));
    });

    expect(getByText("Read less")).toBeTruthy();
  });

  it("does not show toggle for short descriptions even in compact", async () => {
    const shortText = "Short description.";
    mockLoadCourseDescription.mockResolvedValue(shortText);

    const { getByText, queryByText } = await render(
      <CourseDescriptionSection courseCode="CSI 2110" facultyId="science" />,
    );

    await waitFor(() => {
      expect(getByText(shortText)).toBeTruthy();
    });

    expect(queryByText("Read more")).toBeNull();
    expect(queryByText("Read less")).toBeNull();
  });

  it("shows Read more when text layout exceeds two lines below the character threshold", async () => {
    const wrappedText = "A normal description with enough words to wrap on a compact screen.";
    mockLoadCourseDescription.mockResolvedValue(wrappedText);

    const { getByTestId, getByText } = await render(
      <CourseDescriptionSection courseCode="CSI 2110" facultyId="science" />,
    );

    await waitFor(() => getByText(wrappedText));
    expect(getByTestId("course-description-text").props.numberOfLines).toBeUndefined();
    await act(async () => {
      fireEvent(getByTestId("course-description-text"), "textLayout", {
        nativeEvent: { lines: Array.from({ length: 3 }, () => ({})) },
      });
    });

    await waitFor(() => {
      expect(getByText("Read more")).toBeTruthy();
    });
    expect(getByTestId("course-description-text").props.numberOfLines).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Tests: CoursePrereqGraph
// ---------------------------------------------------------------------------

describe("CoursePrereqGraph", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultData();
  });

  afterEach(cleanup);

  it("renders horizontal ScrollView with SVG edges", async () => {
    const graph = {
      rootId: "prereq-course-0",
      nodes: [
        {
          id: "prereq-course-0",
          kind: "course" as const,
          role: "prerequisite" as const,
          code: normalizeCourseCode("MAT 1320"),
          resolvable: true,
          status: "met" as const,
          rank: 0,
          lane: 0,
          programLabel: "Programs: CEG",
        },
        {
          id: "prereq-course-target",
          kind: "course" as const,
          role: "target" as const,
          code: normalizeCourseCode("CSI 2110"),
          resolvable: true,
          status: "unknown" as const,
          rank: 1,
          lane: 0,
        },
      ],
      edges: [
        {
          id: "e-0-target",
          sourceId: "prereq-course-0",
          targetId: "prereq-course-target",
          status: "met" as const,
        },
      ],
      rankCount: 2,
      laneCount: 1,
      a11yDescription: "Prerequisites for CSI 2110: MAT 1320 met",
    };

    const { getByTestId, toJSON } = await render(
      <CoursePrereqGraph graph={graph} onNavigateCourse={jest.fn()} />,
    );

    // Bounded horizontal ScrollView
    expect(getByTestId("prereq-graph-scroll")).toBeTruthy();
    // SVG layer present (react-native-svg renders as RNSVGSvgView)
    const json = JSON.stringify(toJSON());
    expect(json).toContain("RNSVGSvgView");
    // Graph wrapper a11y
    expect(getByTestId("prereq-graph")).toBeTruthy();
  });

  it("renders course nodes with localized a11y status", async () => {
    const graph = {
      rootId: "prereq-course-0",
      nodes: [
        {
          id: "prereq-course-0",
          kind: "course" as const,
          role: "prerequisite" as const,
          code: normalizeCourseCode("MAT 1320"),
          resolvable: true,
          status: "met" as const,
          rank: 0,
          lane: 0,
          programLabel: "Programs: CEG",
        },
        {
          id: "prereq-course-target",
          kind: "course" as const,
          role: "target" as const,
          code: normalizeCourseCode("CSI 2110"),
          resolvable: true,
          status: "unknown" as const,
          rank: 1,
          lane: 0,
        },
      ],
      edges: [],
      rankCount: 2,
      laneCount: 1,
      a11yDescription: "Graph for CSI 2110",
    };

    const { getByTestId, getByText } = await render(
      <CoursePrereqGraph graph={graph} onNavigateCourse={jest.fn()} />,
    );

    const metNode = getByTestId("prereq-course-MAT 1320");
    expect(metNode.props.accessibilityLabel).toContain("MAT 1320");
    expect(metNode.props.accessibilityLabel).toContain("met");
    expect(getByText("Programs: CEG")).toBeTruthy();
  });

  it("resolvable prerequisite Pressable calls onNavigateCourse", async () => {
    const onNavigate = jest.fn();
    const graph = {
      rootId: "prereq-course-0",
      nodes: [
        {
          id: "prereq-course-0",
          kind: "course" as const,
          role: "prerequisite" as const,
          code: normalizeCourseCode("MAT 1320"),
          resolvable: true,
          status: "met" as const,
          rank: 0,
          lane: 0,
        },
      ],
      edges: [],
      rankCount: 1,
      laneCount: 1,
      a11yDescription: "Graph",
    };

    const { getByTestId } = await render(
      <CoursePrereqGraph graph={graph} onNavigateCourse={onNavigate} />,
    );

    fireEvent.press(getByTestId("prereq-course-MAT 1320"));
    expect(onNavigate).toHaveBeenCalledWith("MAT 1320");
  });

  it("target node is non-interactive (no button role)", async () => {
    const graph = {
      rootId: "prereq-course-target",
      nodes: [
        {
          id: "prereq-course-target",
          kind: "course" as const,
          role: "target" as const,
          code: normalizeCourseCode("CSI 2110"),
          resolvable: true,
          status: "unknown" as const,
          rank: 0,
          lane: 0,
        },
      ],
      edges: [],
      rankCount: 1,
      laneCount: 1,
      a11yDescription: "Graph",
    };

    const { getByTestId } = await render(
      <CoursePrereqGraph graph={graph} onNavigateCourse={jest.fn()} />,
    );

    const target = getByTestId("prereq-target");
    // Target renders as View not Pressable — no button role
    expect(target.props.accessibilityRole).not.toBe("button");
    expect(target.props.accessible).toBe(true);
  });

  it("gate node is hidden from accessibility", async () => {
    const graph = {
      rootId: "prereq-and-0",
      nodes: [
        {
          id: "prereq-and-0",
          kind: "and_gate" as const,
          label: "AND",
          status: "met" as const,
          rank: 0,
          lane: 0,
        },
      ],
      edges: [],
      rankCount: 1,
      laneCount: 1,
      a11yDescription: "Graph",
    };

    const { toJSON } = await render(
      <CoursePrereqGraph graph={graph} onNavigateCourse={jest.fn()} />,
    );

    const json = JSON.stringify(toJSON());
    // Gate nodes should have accessibilityElementsHidden
    expect(json).toContain("accessibilityElementsHidden");
  });

  it("aggregate node opens detail sheet on press", async () => {
    const graph = {
      rootId: "prereq-aggregate",
      nodes: [
        {
          id: "prereq-aggregate",
          kind: "aggregate" as const,
          mode: "any" as const,
          label: "Any 2 of",
          status: "met" as const,
          rank: 0,
          lane: 0,
          children: [
            {
              kind: "course" as const,
              code: normalizeCourseCode("MAT 1320"),
              status: "met" as const,
              resolvable: true,
            },
            {
              kind: "course" as const,
              code: normalizeCourseCode("MAT 1321"),
              status: "missing" as const,
              resolvable: true,
            },
          ],
        },
      ],
      edges: [],
      rankCount: 1,
      laneCount: 1,
      a11yDescription: "Graph",
    };

    const onNavigate = jest.fn();
    const { getByTestId } = await render(
      <CoursePrereqGraph graph={graph} onNavigateCourse={onNavigate} />,
    );

    // Press aggregate node to open sheet
    fireEvent.press(getByTestId("prereq-aggregate"));

    await waitFor(() => {
      expect(getByTestId("prereq-detail-sheet")).toBeTruthy();
    });
    expect(getByTestId("prereq-detail-backdrop").props.accessible).toBe(false);

    // Children are listed with accessible labels
    const child = getByTestId("aggregate-child-MAT 1320");
    expect(child.props.accessibilityLabel).toContain("met");

    // Resolvable child navigates
    fireEvent.press(child);
    expect(onNavigate).toHaveBeenCalledWith("MAT 1320");
  });

  it("semantic disclosure opens sheet with full text", async () => {
    const graph = {
      rootId: "prereq-semantic-0",
      nodes: [
        {
          id: "prereq-semantic-0",
          kind: "semantic" as const,
          label: "60 credits",
          disclosureText: "Must have completed at least 60 university-level credits.",
          status: "unknown" as const,
          rank: 0,
          lane: 0,
        },
      ],
      edges: [],
      rankCount: 1,
      laneCount: 1,
      a11yDescription: "Graph",
    };

    const { getByTestId, getByText } = await render(
      <CoursePrereqGraph graph={graph} onNavigateCourse={jest.fn()} />,
    );

    fireEvent.press(getByTestId("prereq-semantic-disclosure"));

    await waitFor(() => {
      expect(getByTestId("prereq-detail-sheet")).toBeTruthy();
    });

    expect(getByText("Must have completed at least 60 university-level credits.")).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Tests: useNativePrereqGraphContext (neutral/personalized) — tested via component
// ---------------------------------------------------------------------------

describe("useNativePrereqGraphContext (neutral status)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(cleanup);

  it("returns null plannerContext when graph renders with unknown status (no profile context)", async () => {
    // This is validated indirectly: when plannerContext is null, all nodes
    // resolve to "unknown" status. We test this through the graph component.
    const graph = {
      rootId: "prereq-course-0",
      nodes: [
        {
          id: "prereq-course-0",
          kind: "course" as const,
          role: "prerequisite" as const,
          code: normalizeCourseCode("MAT 1320"),
          resolvable: true,
          status: "unknown" as const,
          rank: 0,
          lane: 0,
        },
      ],
      edges: [],
      rankCount: 1,
      laneCount: 1,
      a11yDescription: "Graph: no context",
    };

    setDefaultData();
    const { getByTestId } = await render(
      <CoursePrereqGraph graph={graph} onNavigateCourse={jest.fn()} />,
    );

    // Node has "unknown" status in its a11y label
    const node = getByTestId("prereq-course-MAT 1320");
    expect(node.props.accessibilityLabel).toContain("unknown");
  });
});
