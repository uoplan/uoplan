import { page } from "vitest/browser";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ExploreLayout } from "./ExploreLayout";

type MockOfferingsState = {
  loading: boolean;
  schedulesLoading: boolean;
  schedulesError: string | null;
  retrySchedules: () => void;
  deliveryPresence: {
    allVirtualCourseComponents: ReadonlySet<string>;
    allInPersonCourseComponents: ReadonlySet<string>;
    virtualCourseComponentsByTerm: Map<number, ReadonlySet<string>>;
    inPersonCourseComponentsByTerm: Map<number, ReadonlySet<string>>;
  };
  getCourseEntries: () => [];
  getCourseEntryByNorm: () => Map<string, never>;
  getProfessorEntries: () => [];
  getTermPresence: () => {
    courseComponentsByTerm: Map<number, Set<string>>;
    profGroupsByTerm: Map<number, Set<string>>;
  };
  getCourseFuse: () => null;
};

const mocks = vi.hoisted(() => ({
  capture: vi.fn(),
  offerings: {
    loading: false,
    schedulesLoading: false,
    schedulesError: null,
    retrySchedules: vi.fn(),
    deliveryPresence: {
      allVirtualCourseComponents: new Set<string>(),
      allInPersonCourseComponents: new Set<string>(),
      virtualCourseComponentsByTerm: new Map<number, ReadonlySet<string>>(),
      inPersonCourseComponentsByTerm: new Map<number, ReadonlySet<string>>(),
    },
    getCourseEntries: () => [],
    getCourseEntryByNorm: () => new Map<string, never>(),
    getProfessorEntries: () => [],
    getTermPresence: () => ({
      courseComponentsByTerm: new Map<number, Set<string>>(),
      profGroupsByTerm: new Map<number, Set<string>>(),
    }),
    getCourseFuse: () => null,
  } as MockOfferingsState,
  search: {
    query: "",
    debouncedQuery: "",
    filters: {},
    activeFilters: false,
    searchEngaged: false,
    setSearchEngaged: vi.fn(),
    currentSearchParams: {},
    handleQueryChange: vi.fn(),
    handleFilterChange: vi.fn(),
  },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: "a",
  useRouterState: ({
    select,
  }: {
    select: (state: { matches: Array<{ routeId: string }> }) => unknown;
  }) => select({ matches: [{ routeId: "/explore/" }] }),
}));

vi.mock("@uoplan/store/hooks", () => ({
  useCatalogue: () => null,
  useCompletedCourses: () => ({ completedCourses: [] }),
  useDisciplines: () => null,
  useFaculties: () => null,
  useProfessorRatings: () => null,
  useRequirementState: () => ({ remainingRequirements: [] }),
  useTerms: () => [],
}));

vi.mock("../../lib/analytics", () => ({
  useAnalytics: () => ({ capture: mocks.capture }),
}));

vi.mock("../../hooks/useFeedbackData", () => ({
  useFeedbackData: () => ({ data: null }),
}));

vi.mock("../../hooks/useDescriptionSearchIndex", () => ({
  useDescriptionSearchIndex: () => ({ index: null }),
}));

vi.mock("./exploreOfferingsContext", () => ({
  useExploreOfferings: () => mocks.offerings,
}));

vi.mock("./useExploreSearch", () => ({
  useExploreSearch: () => mocks.search,
}));

vi.mock("../basket/AddToBasketButton", () => ({
  AddToBasketButton: () => null,
}));

vi.mock("../basket/BasketFab", () => ({
  BasketFab: () => null,
}));

vi.mock("./compare/AddToCompareButton", () => ({
  AddToCompareButton: () => null,
}));

vi.mock("./compare/CompareTray", () => ({
  CompareTray: () => null,
}));

vi.mock("./ExploreSearchResults", () => ({
  ExploreSearchResults: () => <div>results</div>,
}));

vi.mock("../shared/BackButton", () => ({
  BackButton: () => <button type="button">Back</button>,
}));

vi.mock("./ExploreFilterBar", () => ({
  ExploreFilterBar: () => <div>filters</div>,
}));

describe("ExploreLayout delivery schedule gating", () => {
  beforeEach(() => {
    mocks.capture.mockClear();
    mocks.search = {
      query: "",
      debouncedQuery: "",
      filters: { ...EMPTY_FILTERS, delivery: "virtual" },
      activeFilters: true,
      searchEngaged: true,
      setSearchEngaged: vi.fn(),
      currentSearchParams: { delivery: "virtual" },
      handleQueryChange: vi.fn(),
      handleFilterChange: vi.fn(),
    };
    mocks.offerings = {
      ...mocks.offerings,
      loading: false,
      schedulesLoading: false,
      schedulesError: null,
      retrySchedules: vi.fn(),
    };
  });

  test("keeps the search input enabled while delivery schedules are still loading", async () => {
    mocks.offerings = {
      ...mocks.offerings,
      schedulesLoading: true,
    };

    await renderWithProviders(
      <ExploreLayout>
        <div>child</div>
      </ExploreLayout>,
    );

    await expect
      .element(page.getByRole("textbox", { name: "Search courses or professors…" }))
      .toBeEnabled();
  });

  test("does not emit a completed search analytics event while active delivery errors remain", async () => {
    mocks.offerings = {
      ...mocks.offerings,
      schedulesError: "delivery load failed",
    };

    await renderWithProviders(
      <ExploreLayout>
        <div>child</div>
      </ExploreLayout>,
    );

    expect(mocks.capture).not.toHaveBeenCalled();
  });
});
