import { page } from "vitest/browser";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { EMPTY_EXPLORE_DELIVERY_PRESENCE } from "../../lib/explore/deliveryMode";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { EMPTY_EXPLORE_SEARCH, EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ExploreCoursePage } from "./ExploreCoursePage";
import type { ExploreOfferingsValue } from "./useExploreOfferingsValue";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  capture: vi.fn(),
  courseEntries: new Map<string, ExploreCourseSearchEntry>(),
  schedulesLoading: false,
}));

vi.mock("@tanstack/react-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-router")>()),
  Link: "a",
  useNavigate: () => mocks.navigate,
}));

vi.mock("@uoplan/store/hooks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@uoplan/store/hooks")>()),
  useCompletedCourses: () => ({ completedCourses: [] }),
  useDataCache: () => ({
    getCourse: (code: string) =>
      code === "TMM 3009"
        ? {
            code: "TMM 3009",
            title: "Biomedical Research Laboratory",
            credits: 3,
            description: "",
          }
        : undefined,
  }),
  useDisciplines: () => [],
  useFaculties: () => [],
  useProfessorRegistry: () => null,
  useProgramSelection: () => ({ program: null, studentPrograms: [] }),
  useTerms: () => [],
}));

vi.mock("../../hooks/useFeedbackViews", () => ({
  useCourseFeedbackViews: () => ({ views: [], loading: false }),
}));

vi.mock("../../hooks/useScheduleSentiment", () => ({
  useScheduleSentiment: () => ({ professorByName: null }),
}));

vi.mock("../../lib/analytics", () => ({
  useAnalytics: () => ({ capture: mocks.capture }),
}));

vi.mock("./CourseDescriptionSection", () => ({
  CourseDescriptionSection: () => null,
}));

vi.mock("./useExploreDetailFilters", () => ({
  useExploreDetailFilters: () => ({
    filters: EMPTY_FILTERS,
    sentiment: undefined,
    requirementCandidateSet: null,
    linkSearch: EMPTY_EXPLORE_SEARCH,
  }),
}));

vi.mock("./exploreOfferingsContext", () => ({
  useExploreOfferings: (): ExploreOfferingsValue => ({
    offerings: [],
    loading: false,
    schedulesLoading: mocks.schedulesLoading,
    schedulesError: null,
    retrySchedules: vi.fn(),
    deliveryPresence: EMPTY_EXPLORE_DELIVERY_PRESENCE,
    offeringsByCourseNorm: new Map(),
    aliasGroups: { componentByNorm: new Map(), membersByComponent: new Map() },
    offeringsByComponent: new Map(),
    getCourseEntries: () => [...mocks.courseEntries.values()],
    getCourseEntryByNorm: () => mocks.courseEntries,
    getProfessorEntries: () => [],
    getTermPresence: () => ({
      courseComponentsByTerm: new Map(),
      profGroupsByTerm: new Map(),
    }),
    getCourseFuse: () => null,
  }),
}));

describe("ExploreCoursePage catalogue-only courses", () => {
  beforeEach(() => {
    mocks.navigate.mockClear();
    mocks.capture.mockClear();
    mocks.schedulesLoading = false;
    mocks.courseEntries = new Map([
      [
        "TMM 3009",
        {
          normCode: "TMM 3009",
          courseCode: "TMM 3009",
          courseTitle: "Biomedical Research Laboratory",
          fuseText: "tmm 3009 biomedical research laboratory",
          gradeViz: null,
          level: 3000,
          language: null,
          maxProfessorRating: null,
          componentId: "TMM 3009",
        } as ExploreCourseSearchEntry,
      ],
    ]);
  });

  it("renders catalogue metadata and the empty grade state without redirecting", async () => {
    await renderWithProviders(
      <ExploreCoursePage urlCourseParam="tmm3009" professorRatings={null} />,
    );

    await expect.element(page.getByRole("heading", { name: "TMM 3009" })).toBeVisible();
    await expect.element(page.getByText("Biomedical Research Laboratory")).toBeVisible();
    await expect.element(page.getByText("No grade data found for this course.")).toBeVisible();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("waits for schedule-only entries before redirecting a valid course code", async () => {
    mocks.courseEntries = new Map();
    mocks.schedulesLoading = true;

    await renderWithProviders(
      <ExploreCoursePage urlCourseParam="cml2741" professorRatings={null} />,
    );

    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("redirects after all course sources load without a matching entry", async () => {
    mocks.courseEntries = new Map();

    await renderWithProviders(
      <ExploreCoursePage urlCourseParam="zzz9999" professorRatings={null} />,
    );

    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/explore",
      search: EMPTY_EXPLORE_SEARCH,
      replace: true,
    });
  });
});
