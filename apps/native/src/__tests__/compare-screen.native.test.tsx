import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import type { FeedbackIndex } from "@uoplan/core/feedback";
import type { SchedulesData } from "@uoplan/core/dataTypes";
import { buildAliasGroups } from "@uoplan/core/courseAlias";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import CompareScreen from "@/app/(tabs)/explore/compare/[resource]";
import { useCompare } from "@/data/compare-provider";
import { useAppData, useFeedback } from "@/data/data-provider";
import { buildExploreIndex, type AppDataBundle } from "@/data/explore-index";
import { useAnalytics } from "@/lib/analytics";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock(
  "@/data/compare-provider",
  () => ({
    useCompare: jest.fn(),
  }),
  { virtual: true },
);

jest.mock("@/data/data-provider", () => ({
  useAppData: jest.fn(),
  useFeedback: jest.fn(),
}));

jest.mock("@/lib/analytics", () => ({
  useAnalytics: jest.fn(),
}));

jest.mock("@/i18n", () => ({
  useTr: () => (id: string, values?: Record<string, unknown>) => {
    const messages: Record<string, string> = {
      "compare.empty.body":
        "Select courses from their detail pages, then come back to compare them.",
      "compare.empty.title": "Pick at least 2 to compare",
      "compare.kind.course": "Courses",
      "compare.page.title": "Compare courses",
      "compare.remove": "Remove",
      "compare.remove.aria": `Remove ${String(values?.name ?? "")} from comparison`,
      "compare.row.avgGpa": "Average GPA",
      "compare.row.credits": "Credits",
      "compare.row.faculty": "Faculty",
      "compare.row.grades": "Grades",
      "compare.row.language": "Language",
      "compare.row.level": "Level",
      "compare.row.passing": "Passing",
      "compare.row.prereqs": "Prerequisites",
      "compare.row.sentiment": "Student feedback",
      "compare.row.terms": "Terms",
      "compare.row.topRating": "Top rating",
      "compare.value.noPrereqs": "None",
      "compare.value.none": "—",
    };
    return messages[id] ?? id;
  },
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function makeBundle(): AppDataBundle {
  return {
    terms: [],
    faculties: [{ id: "engineering", name: "Faculty of Engineering" }],
    disciplines: [{ code: "ITI", name: "Information Technology", facultyId: "engineering" }],
    catalogue: {
      courses: [
        {
          code: normalizeCourseCode("ITI 1120"),
          title: "Intro to Computing",
          credits: 3,
          description: "",
        },
        {
          code: normalizeCourseCode("ITI 1121"),
          title: "Data Structures",
          credits: 3,
          description: "",
        },
      ],
      programs: [],
    },
    professors: [],
    ratings: {},
    grades: {
      courses: [
        {
          code: normalizeCourseCode("ITI 1120"),
          sections: [
            { name: "Ada Lovelace", professorRef: 0, termId: 2265, distribution: { A: 10, F: 2 } },
          ],
        },
        {
          code: normalizeCourseCode("ITI 1121"),
          sections: [
            { name: "Ada Lovelace", professorRef: 0, termId: 2265, distribution: { B: 9, F: 1 } },
          ],
        },
      ],
    },
  } as unknown as AppDataBundle;
}

function makeSchedules(): Map<string, SchedulesData> {
  return new Map([
    [
      "2265",
      {
        termId: "2265",
        schedules: [
          {
            subject: "ITI",
            catalogNumber: "1120",
            courseCode: normalizeCourseCode("ITI 1120"),
            title: "Intro to Computing",
            timeZone: "America/Toronto",
            components: {},
          },
          {
            subject: "ITI",
            catalogNumber: "1121",
            courseCode: normalizeCourseCode("ITI 1121"),
            title: "Data Structures",
            timeZone: "America/Toronto",
            components: {},
          },
        ],
      } as SchedulesData,
    ],
  ]);
}

function makeFeedback(): FeedbackIndex {
  return { questions: [], byCourseNorm: new Map() };
}

describe("course compare screen", () => {
  const back = jest.fn();
  const setParams = jest.fn();
  const remove = jest.fn();
  const capture = jest.fn();

  beforeEach(() => {
    back.mockClear();
    setParams.mockClear();
    remove.mockClear();
    capture.mockClear();
    jest.mocked(useRouter).mockReturnValue({ back, setParams } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({
      resource: "course",
      ids: "ITI 1120,ITI 1121",
    });
    const bundle = makeBundle();
    const schedulesByTerm = makeSchedules();
    jest.mocked(useAppData).mockReturnValue({
      bundle,
      index: buildExploreIndex(bundle, schedulesByTerm),
      schedulesByTerm,
      feedback: makeFeedback(),
      aliasGroups: buildAliasGroups(bundle.catalogue),
      catalogueYears: [2026],
    } as never);
    jest.mocked(useFeedback).mockReturnValue(makeFeedback());
    jest.mocked(useCompare).mockReturnValue({
      refs: [
        { kind: "course", id: "ITI 1120" },
        { kind: "course", id: "ITI 1121" },
      ],
      count: 2,
      has: jest.fn(),
      toggle: jest.fn(),
      add: jest.fn(),
      remove,
      clear: jest.fn(),
    });
    jest.mocked(useAnalytics).mockReturnValue({ capture } as never);
  });

  it("renders the URL-selected courses side-by-side and removes a column through provider plus URL state", async () => {
    const { getByLabelText, getByText, queryByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <CompareScreen />
      </SafeAreaProvider>,
    );

    expect(getByText("Compare courses")).toBeTruthy();
    expect(getByText("ITI 1120")).toBeTruthy();
    expect(getByText("ITI 1121")).toBeTruthy();
    expect(getByText("Credits")).toBeTruthy();
    expect(capture).toHaveBeenCalledWith("compare_viewed", {
      kind: "course",
      count: 2,
      ids: ["ITI 1120", "ITI 1121"],
    });

    fireEvent.press(getByLabelText("Remove ITI 1121 from comparison"));

    expect(remove).toHaveBeenCalledWith({ kind: "course", id: "ITI 1121" });
    expect(setParams).toHaveBeenCalledWith({ ids: "ITI 1120" });
    await waitFor(() => expect(getByText("Pick at least 2 to compare")).toBeTruthy());
    expect(queryByText("ITI 1121")).toBeNull();
  });
});
