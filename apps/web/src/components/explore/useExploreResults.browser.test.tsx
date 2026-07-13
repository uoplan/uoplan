import { render } from "vitest-browser-react";
import { describe, expect, test, vi } from "vitest";
import type {
  Catalogue,
  Discipline,
  Faculty,
  NormalizedCourseCode,
  SchedulesData,
} from "@uoplan/core";
import { createExploreCourseFuse } from "../../lib/explore/gradesSearch";
import type {
  ExploreCourseSearchEntry,
  ExploreProfessorSearchEntry,
  TermPresenceIndex,
} from "../../lib/explore/gradesSearch";
import { buildExploreDeliveryPresenceIndex } from "../../lib/explore/deliveryMode";
import { EMPTY_FILTERS } from "../../lib/explore/exploreFilters";
import { useExploreResults } from "./useExploreResults";

type MockOfferingsState = {
  loading: boolean;
  schedulesLoading: boolean;
  schedulesError: string | null;
  retrySchedules: () => void;
  deliveryPresence: ReturnType<typeof buildExploreDeliveryPresenceIndex> | undefined;
  getCourseEntries: () => ExploreCourseSearchEntry[];
  getCourseEntryByNorm: () => Map<string, ExploreCourseSearchEntry>;
  getProfessorEntries: () => ExploreProfessorSearchEntry[];
  getTermPresence: () => TermPresenceIndex;
  getCourseFuse: () => ReturnType<typeof createExploreCourseFuse> | null;
};

const mocks = vi.hoisted(() => ({
  offerings: {
    loading: false,
    schedulesLoading: false,
    schedulesError: null,
    retrySchedules: vi.fn(),
    deliveryPresence: undefined,
    getCourseEntries: () => [] as ExploreCourseSearchEntry[],
    getCourseEntryByNorm: () => new Map<string, ExploreCourseSearchEntry>(),
    getProfessorEntries: () => [] as ExploreProfessorSearchEntry[],
    getTermPresence: () =>
      ({
        courseComponentsByTerm: new Map(),
        profGroupsByTerm: new Map(),
      }) as TermPresenceIndex,
    getCourseFuse: () => null,
  } as MockOfferingsState,
}));

vi.mock("../../hooks/useFeedbackData", () => ({
  useFeedbackData: () => ({ data: null }),
}));

vi.mock("../../hooks/useDescriptionSearchIndex", () => ({
  useDescriptionSearchIndex: () => ({ index: null }),
}));

vi.mock("../../lib/graph/professorGraphSearch", () => ({
  searchProfessorsScored: (
    entries: Array<{ id: string; searchText: string }>,
    rawQuery: string,
  ) => {
    const query = rawQuery.trim().toLowerCase();
    const items =
      query.length === 0 ? [] : entries.filter((entry) => entry.searchText.includes(query));
    return { items, topRank: items.length > 0 ? 0 : null };
  },
}));

vi.mock("./exploreOfferingsContext", () => ({
  useExploreOfferings: () => mocks.offerings,
}));

type HarnessProps = Parameters<typeof useExploreResults>[0];

let hookResult: ReturnType<typeof useExploreResults>;
function Harness(props: HarnessProps) {
  hookResult = useExploreResults(props);
  return null;
}

function norm(code: string): NormalizedCourseCode {
  return code as NormalizedCourseCode;
}

function makeCourseEntry(
  entry: Partial<ExploreCourseSearchEntry> &
    Pick<ExploreCourseSearchEntry, "normCode" | "courseCode" | "componentId">,
): ExploreCourseSearchEntry {
  return {
    courseTitle: "",
    fuseText: `${entry.courseCode} ${entry.courseTitle ?? ""}`.toLowerCase(),
    gradeViz: null,
    level: null,
    language: null,
    maxProfessorRating: null,
    ...entry,
  };
}

function makeProfessorEntry(
  entry: Partial<ExploreProfessorSearchEntry> &
    Pick<ExploreProfessorSearchEntry, "groupId" | "displayName">,
): ExploreProfessorSearchEntry {
  return {
    slug: entry.displayName.toLowerCase().replaceAll(/\s+/g, "-"),
    searchText: entry.displayName.toLowerCase(),
    uniqueCourseCount: 1,
    disciplines: ["CSI"],
    gradeViz: null,
    maxRating: null,
    ...entry,
  };
}

function makeSchedulesData(termId: number, courseCode: string, virtual: boolean): SchedulesData {
  return {
    termId: String(termId),
    schedules: [
      {
        subject: courseCode.split(" ")[0] ?? "",
        catalogNumber: courseCode.split(" ")[1] ?? "",
        courseCode: norm(courseCode),
        title: null,
        timeZone: "America/Toronto",
        components: {
          LEC: [
            {
              section: "A",
              sectionCode: null,
              component: "LEC",
              session: null,
              status: null,
              times: [
                {
                  day: "Mo",
                  startMinutes: 540,
                  endMinutes: 600,
                  virtual,
                },
              ],
            },
          ],
        },
      },
    ],
  };
}

function makeDeliveryPresence(): ReturnType<typeof buildExploreDeliveryPresenceIndex> {
  const aliasComponents = new Map<NormalizedCourseCode, NormalizedCourseCode>([
    [norm("CSI 1150"), norm("CSI 1100")],
    [norm("CSI 1100"), norm("CSI 1100")],
    [norm("MAT 1320"), norm("MAT 1320")],
  ]);
  return buildExploreDeliveryPresenceIndex(
    [
      makeSchedulesData(2269, "CSI 1100", true),
      makeSchedulesData(2269, "MAT 1320", false),
      makeSchedulesData(2271, "MAT 1320", true),
    ],
    aliasComponents,
  );
}

function makeTermPresence(): TermPresenceIndex {
  return {
    courseComponentsByTerm: new Map<number, Set<NormalizedCourseCode>>([
      [2269, new Set([norm("CSI 1100"), norm("MAT 1320")])],
      [2271, new Set([norm("MAT 1320")])],
    ]),
    profGroupsByTerm: new Map<number, Set<string>>([[2269, new Set(["science-ada"])]]),
  };
}

const courseEntries = [
  makeCourseEntry({
    normCode: norm("CSI 1150"),
    courseCode: norm("CSI 1150"),
    courseTitle: "Computing Foundations",
    componentId: norm("CSI 1100"),
  }),
  makeCourseEntry({
    normCode: norm("MAT 1320"),
    courseCode: norm("MAT 1320"),
    courseTitle: "Applied Mathematics",
    componentId: norm("MAT 1320"),
  }),
  makeCourseEntry({
    normCode: norm("TMM 3009"),
    courseCode: norm("TMM 3009"),
    courseTitle: "Biomedical Research Laboratory",
    componentId: norm("TMM 3009"),
  }),
];

const professorEntries = [
  makeProfessorEntry({
    groupId: "science-ada",
    displayName: "Science Ada" as ExploreProfessorSearchEntry["displayName"],
    searchText: "science ada",
  }),
];

const catalogue: Catalogue = {
  courses: [
    {
      code: norm("CSI 1150"),
      title: "Computing Foundations",
      credits: 3,
      description: "",
      aliases: [norm("CSI 1100")],
    },
    {
      code: norm("MAT 1320"),
      title: "Applied Mathematics",
      credits: 3,
      description: "",
    },
    {
      code: norm("TMM 3009"),
      title: "Biomedical Research Laboratory",
      credits: 3,
      description: "",
    },
  ],
  programs: [
    {
      title: "Science Major",
      url: "https://example.test/programs/science-major",
      requirements: [{ type: "course", code: "CSI 1150" }],
    },
  ],
};

const disciplines: Discipline[] = [
  { code: "SCI", name: "Science Studies", facultyId: "science" as Faculty["id"] },
];

const faculties: Faculty[] = [{ id: "science" as Faculty["id"], name: "Science Faculty" }];

function setOfferingsState({
  loading = false,
  schedulesLoading = false,
  schedulesError = null,
  deliveryPresence = makeDeliveryPresence(),
}: {
  loading?: boolean;
  schedulesLoading?: boolean;
  schedulesError?: string | null;
  deliveryPresence?: ReturnType<typeof buildExploreDeliveryPresenceIndex>;
} = {}) {
  mocks.offerings = {
    loading,
    schedulesLoading,
    schedulesError,
    retrySchedules: vi.fn(),
    deliveryPresence,
    getCourseEntries: () => courseEntries,
    getCourseEntryByNorm: () => new Map(courseEntries.map((entry) => [entry.normCode, entry])),
    getProfessorEntries: () => professorEntries,
    getTermPresence: () => makeTermPresence(),
    getCourseFuse: () => createExploreCourseFuse(courseEntries),
  };
}

function makeProps(overrides: Partial<HarnessProps> = {}): HarnessProps {
  return {
    query: "",
    debouncedQuery: "",
    filters: EMPTY_FILTERS,
    activeFilters: false,
    catalogue,
    disciplines,
    faculties,
    remainingRequirements: [],
    completedCourses: [],
    ...overrides,
  };
}

function displayedCourseComponents(): string[] {
  return hookResult.displayedCourses.map((entry) => entry.componentId);
}

function displayedCourseCodes(): string[] {
  return hookResult.displayedCourses.map((entry) => entry.courseCode);
}

function setValues(values: ReadonlySet<string> | undefined): string[] {
  return [...(values ?? new Set<string>())].sort();
}

function virtualCourseComponents(): string[] {
  const result = hookResult as ReturnType<typeof useExploreResults> & {
    virtualCourseComponents?: ReadonlySet<string>;
  };
  return setValues(result.virtualCourseComponents);
}

describe("useExploreResults delivery filtering", () => {
  test("a virtual delivery filter keeps a course whose component is present for the selected term", async () => {
    setOfferingsState();

    await render(
      <Harness
        {...makeProps({
          query: "comp",
          debouncedQuery: "comp",
          activeFilters: true,
          filters: { ...EMPTY_FILTERS, delivery: "virtual", termId: 2269 },
        })}
      />,
    );

    await expect.poll(displayedCourseComponents).toEqual(["CSI 1100"]);
    expect(hookResult.hasResults).toBe(true);
  });

  test("an in-person delivery filter selects only in-person components in filter-only mode", async () => {
    setOfferingsState();

    await render(
      <Harness
        {...makeProps({
          activeFilters: true,
          filters: { ...EMPTY_FILTERS, delivery: "in-person", termId: 2269 },
        })}
      />,
    );

    expect(displayedCourseComponents()).toEqual(["MAT 1320"]);
  });

  test("selected terms scope delivery to that term while no term uses the all-term virtual union", async () => {
    setOfferingsState();

    const screen = await render(
      <Harness
        {...makeProps({
          activeFilters: true,
          filters: { ...EMPTY_FILTERS, delivery: "virtual", termId: 2269 },
        })}
      />,
    );

    expect(displayedCourseComponents()).toEqual(["CSI 1100"]);
    expect(virtualCourseComponents()).toEqual(["CSI 1100"]);

    await screen.rerender(
      <Harness
        {...makeProps({
          activeFilters: true,
          filters: { ...EMPTY_FILTERS, delivery: "virtual", termId: null },
        })}
      />,
    );

    expect(displayedCourseComponents()).toEqual(["CSI 1100", "MAT 1320"]);
    expect(virtualCourseComponents()).toEqual(["CSI 1100", "MAT 1320"]);
  });

  test("active delivery suppresses non-course entities and computes hasResults from the scoped arrays", async () => {
    setOfferingsState();

    await render(
      <Harness
        {...makeProps({
          query: "science",
          debouncedQuery: "science",
          activeFilters: true,
          filters: { ...EMPTY_FILTERS, delivery: "virtual", termId: 2269 },
        })}
      />,
    );

    expect(hookResult.displayedCourses).toEqual([]);
    expect(hookResult.displayedProfessors).toEqual([]);
    expect(hookResult.disciplineResults).toEqual([]);
    expect(hookResult.facultyResults).toEqual([]);
    expect(hookResult.programResults).toEqual([]);
    expect(hookResult.hasResults).toBe(false);
  });

  test("schedule loading sets deliveryLoading without blocking global loading once grades are loaded", async () => {
    setOfferingsState({ schedulesLoading: true });

    const screen = await render(<Harness {...makeProps()} />);
    expect(hookResult.loading).toBe(false);
    expect((hookResult as { deliveryLoading?: boolean }).deliveryLoading).toBe(false);

    await screen.rerender(
      <Harness
        {...makeProps({
          activeFilters: true,
          filters: { ...EMPTY_FILTERS, delivery: "virtual" },
        })}
      />,
    );

    expect(hookResult.loading).toBe(false);
    expect((hookResult as { deliveryLoading?: boolean }).deliveryLoading).toBe(true);
  });

  test("active delivery errors surface deliveryError while preserving the raw schedulesError", async () => {
    setOfferingsState({ schedulesError: "delivery load failed" });

    await render(
      <Harness
        {...makeProps({
          activeFilters: true,
          filters: { ...EMPTY_FILTERS, delivery: "virtual", termId: 2269 },
        })}
      />,
    );

    expect(hookResult.loading).toBe(false);
    expect((hookResult as { deliveryError?: string | null }).deliveryError).toBe(
      "delivery load failed",
    );
    expect((hookResult as { schedulesError?: string | null }).schedulesError).toBe(
      "delivery load failed",
    );
  });
});

describe("useExploreResults catalogue-only courses", () => {
  test("returns a catalogue-only entry by code and title", async () => {
    setOfferingsState();

    const screen = await render(
      <Harness
        {...makeProps({
          query: "tmm 3009",
          debouncedQuery: "tmm 3009",
        })}
      />,
    );

    expect(displayedCourseCodes()).toEqual(["TMM 3009"]);

    await screen.rerender(
      <Harness
        {...makeProps({
          query: "biomedical research",
          debouncedQuery: "biomedical research",
        })}
      />,
    );

    expect(displayedCourseCodes()).toEqual(["TMM 3009"]);
  });

  test("keeps catalogue-only entries out of grade-dependent filters", async () => {
    setOfferingsState();

    await render(
      <Harness
        {...makeProps({
          query: "tmm 3009",
          debouncedQuery: "tmm 3009",
          activeFilters: true,
          filters: { ...EMPTY_FILTERS, difficulty: "tough" },
        })}
      />,
    );

    expect(displayedCourseCodes()).toEqual([]);
  });
});
