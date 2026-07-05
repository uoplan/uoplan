import { cleanup, fireEvent, render } from "@testing-library/react-native";

import type { Catalogue, Course, DisciplinesData, Term } from "@uoplan/core/dataTypes";
import { normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { BasketDrawer } from "@/components/basket-drawer";
import type { ExploreIndex } from "@/data/explore-index";

const mockPush = jest.fn();
const mockUseBasket = jest.fn();
const mockUseAppData = jest.fn();
const mockUseScheduleOptions = jest.fn();

jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/data/basket-provider", () => ({
  useBasket: () => mockUseBasket(),
}));

jest.mock("@/data/completed-courses-provider", () => ({
  useCompletedCourses: () => ({
    codes: [],
    count: 0,
    has: () => false,
    add: jest.fn(),
    remove: jest.fn(),
    set: jest.fn(),
    clear: jest.fn(),
  }),
}));

jest.mock("@/data/data-provider", () => ({
  useAppData: () => mockUseAppData(),
}));

jest.mock("@/data/schedule-options-provider", () => ({
  useScheduleOptions: () => mockUseScheduleOptions(),
}));

jest.mock("@/lib/adaptive-layout", () => ({
  useAdaptiveLayout: () => ({ width: 390, height: 844, formSheet: false }),
}));

const gradeViz = normalizeGradeVizDistribution({ A: 80, F: 20 });
const terms: Term[] = [{ termId: "202509", name: "Fall 2025" }];
const disciplines: DisciplinesData = { disciplines: [], faculties: [] };

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
    makeCourse({ code: "AAA 1000", title: "Introductory course" }),
    makeCourse({
      code: "BBB 2000",
      title: "Follow-up course",
      prerequisites: { type: "course", code: "AAA 1000" },
    }),
  ],
};

const index: ExploreIndex = {
  courses: [
    {
      code: "AAA 1000",
      title: "Introductory course",
      discipline: "AAA",
      distribution: {},
      gradeViz,
      gpa: 8.6,
      graded: 100,
      failRate: 0.2,
      termIds: ["202509"],
    },
    {
      code: "BBB 2000",
      title: "Follow-up course",
      discipline: "BBB",
      distribution: {},
      gradeViz,
      gpa: 8.4,
      graded: 100,
      failRate: 0.2,
      termIds: ["202601"],
    },
  ],
  disciplines: [],
  faculties: [],
  professors: [],
  programs: [],
  descriptionIndex: null,
};

function setData() {
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
  });
  mockUseScheduleOptions.mockReturnValue({
    personalization: { termId: "202509", startYear: null, programUrl: null },
  });
}

function setBasket(codes: string[]) {
  const add = jest.fn();
  mockUseBasket.mockReturnValue({
    codes,
    count: codes.length,
    has: (code: string) => codes.includes(code),
    add,
    remove: jest.fn(),
    toggle: jest.fn(),
    clear: jest.fn(),
  });
  return { add };
}

describe("BasketDrawer", () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockUseBasket.mockReset();
    mockUseAppData.mockReset();
    mockUseScheduleOptions.mockReset();
    setData();
  });

  afterEach(cleanup);

  it("groups courses by status as compact pills without grade distribution", async () => {
    setBasket(["BBB 2000"]);

    const { getByPlaceholderText, getByText, queryByText } = await render(
      <BasketDrawer opened onClose={jest.fn()} />,
    );

    expect(getByText("BBB 2000")).toBeTruthy();
    expect(getByText("Follow-up course")).toBeTruthy();
    // BBB 2000 is only offered in 202601, so in the 202509 term it is unavailable.
    expect(getByText("Not available")).toBeTruthy();
    // The grade distribution, average/level meta, and inline badges are gone.
    expect(queryByText("80% passing")).toBeNull();
    expect(queryByText("Average A-")).toBeNull();
    expect(queryByText("Prerequisites not met")).toBeNull();
    expect(queryByText("Not offered in Fall 2025")).toBeNull();
    expect(getByPlaceholderText("Search for courses to add")).toBeTruthy();
    expect(getByText("Generate")).toBeTruthy();
    expect(queryByText("Generate schedule")).toBeNull();
  });

  it("leads with embedded search in the empty state and adds a result", async () => {
    const { add } = setBasket([]);

    const { findByText, getByPlaceholderText, getByLabelText } = await render(
      <BasketDrawer opened onClose={jest.fn()} />,
    );

    fireEvent.changeText(getByPlaceholderText("Search for courses to add"), "intro");
    expect(await findByText("AAA 1000")).toBeTruthy();

    fireEvent.press(getByLabelText("Add AAA 1000"));
    expect(add).toHaveBeenCalledWith("AAA 1000");
  });
});
