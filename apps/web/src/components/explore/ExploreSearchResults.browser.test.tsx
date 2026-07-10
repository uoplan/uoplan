import { page } from "vitest/browser";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { Discipline, Faculty, NormalizedCourseCode, ProfessorRatingsMap } from "@uoplan/core";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import { tr } from "../../i18n";
import { renderWithProviders } from "../../test/renderWithProviders";
import { ExploreSearchResults } from "./ExploreSearchResults";

const retrySchedules = vi.fn();

vi.mock("../../hooks/useFeedbackData", () => ({
  useFeedbackData: () => ({ data: null }),
}));

vi.mock("./exploreOfferingsContext", () => ({
  useExploreOfferings: () => ({ offeringsByCourseNorm: new Map() }),
}));

vi.mock("./SearchResultCourseCard", () => ({
  SearchResultCourseCard: ({ entry }: { entry: { courseCode: string } }) => (
    <div>{`Course ${entry.courseCode}`}</div>
  ),
}));

vi.mock("./SearchResultDisciplineCard", () => ({
  SearchResultDisciplineCard: ({ discipline }: { discipline: { code: string } }) => (
    <div>{`Discipline ${discipline.code}`}</div>
  ),
}));

vi.mock("./SearchResultFacultyCard", () => ({
  SearchResultFacultyCard: ({ faculty }: { faculty: { name: string } }) => (
    <div>{`Faculty ${faculty.name}`}</div>
  ),
}));

vi.mock("./SearchResultProfessorCard", () => ({
  SearchResultProfessorCard: ({ entry }: { entry: { displayName: string } }) => (
    <div>{`Professor ${entry.displayName}`}</div>
  ),
}));

vi.mock("./SearchResultProgramCard", () => ({
  SearchResultProgramCard: ({ program }: { program: { title: string } }) => (
    <div>{`Program ${program.title}`}</div>
  ),
}));

function norm(code: string): NormalizedCourseCode {
  return code as NormalizedCourseCode;
}

function makeCourseEntry(
  entry: Pick<ExploreCourseSearchEntry, "normCode" | "courseCode" | "componentId">,
): ExploreCourseSearchEntry {
  return {
    ...entry,
    courseTitle: "Computing Foundations",
    fuseText: `${entry.courseCode} Computing Foundations`.toLowerCase(),
    gradeViz: null,
    level: null,
    language: null,
    maxProfessorRating: null,
  };
}

type DeliveryAwareProps = {
  hasResults: boolean;
  activeFilters: boolean;
  query: string;
  debouncedQuery: string;
  onClearFilters: () => void;
  professorsFirst: boolean;
  displayedCourses: ExploreCourseSearchEntry[];
  displayedProfessors: [];
  disciplineResults: Discipline[];
  facultyResults: Faculty[];
  disciplines: Discipline[] | null;
  programResults: [];
  disciplineCourseCount: Map<string, number>;
  professorRatings: ProfessorRatingsMap | null;
  currentSearchParams: ExploreSearchParams;
  virtualCourseComponents: ReadonlySet<NormalizedCourseCode>;
  deliveryActive: boolean;
  deliveryLoading: boolean;
  schedulesError: string | null;
  retrySchedules: () => void;
};

function makeProps(overrides: Partial<DeliveryAwareProps> = {}): DeliveryAwareProps {
  return {
    hasResults: false,
    activeFilters: true,
    query: "",
    debouncedQuery: "",
    onClearFilters: () => {},
    professorsFirst: false,
    displayedCourses: [],
    displayedProfessors: [],
    disciplineResults: [],
    facultyResults: [],
    disciplines: null,
    programResults: [],
    disciplineCourseCount: new Map(),
    professorRatings: null,
    currentSearchParams: {} as ExploreSearchParams,
    virtualCourseComponents: new Set<NormalizedCourseCode>(),
    deliveryActive: false,
    deliveryLoading: false,
    schedulesError: null,
    retrySchedules,
    ...overrides,
  };
}

describe("ExploreSearchResults delivery states", () => {
  beforeEach(() => {
    retrySchedules.mockReset();
  });

  test("renders a delivery loading state instead of a false no-results message", async () => {
    await renderWithProviders(
      <ExploreSearchResults
        {...makeProps({
          deliveryActive: true,
          deliveryLoading: true,
        })}
      />,
    );

    await expect.element(page.getByRole("status")).toBeInTheDocument();
    await expect.element(page.getByText(tr("explore.filter.delivery.loading"))).toBeInTheDocument();
    await expect
      .poll(() => page.getByText(tr("explore.filter.noResults")).elements().length)
      .toBe(0);
  });

  test("renders a retryable delivery error instead of the no-results branch", async () => {
    await renderWithProviders(
      <ExploreSearchResults
        {...makeProps({
          deliveryActive: true,
          schedulesError: "delivery load failed",
        })}
      />,
    );

    await expect.element(page.getByRole("alert")).toBeInTheDocument();
    await expect.element(page.getByText(tr("explore.filter.delivery.error"))).toBeInTheDocument();
    await expect
      .poll(() => page.getByText(tr("explore.filter.noResults")).elements().length)
      .toBe(0);

    await page.getByRole("button", { name: "Try again" }).click();
    expect(retrySchedules).toHaveBeenCalledTimes(1);
  });

  test("keeps results visible and shows a warning when schedule enrichment fails off-filter", async () => {
    await renderWithProviders(
      <ExploreSearchResults
        {...makeProps({
          hasResults: true,
          activeFilters: false,
          displayedCourses: [
            makeCourseEntry({
              normCode: norm("CSI 1150"),
              courseCode: norm("CSI 1150"),
              componentId: norm("CSI 1150"),
            }),
          ],
          schedulesError: "delivery load failed",
        })}
      />,
    );

    await expect.element(page.getByRole("status")).toBeInTheDocument();
    await expect.element(page.getByText(tr("explore.filter.delivery.warning"))).toBeInTheDocument();
    await expect.element(page.getByText("Course CSI 1150")).toBeInTheDocument();

    await page.getByRole("button", { name: "Try again" }).click();
    expect(retrySchedules).toHaveBeenCalledTimes(1);
  });
});
