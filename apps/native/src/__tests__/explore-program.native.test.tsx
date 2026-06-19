import { fireEvent, render, waitFor } from "@testing-library/react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import ProgramDetailScreen from "@/app/(tabs)/explore/program/[...slug]";
import { useAppData } from "@/data/data-provider";
import { parseProgramSlugParam, programDetail } from "@/data/explore-detail";
import { buildExploreIndex, type AppDataBundle } from "@/data/explore-index";

jest.mock("expo-router", () => ({
  useLocalSearchParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("@/data/data-provider", () => ({
  useAppData: jest.fn(),
}));

jest.mock("@/components/basket-fab", () => ({
  BasketFab: () => null,
}));

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function makeBundle(): AppDataBundle {
  return {
    terms: [],
    disciplines: [],
    faculties: [],
    grades: {
      courses: [
        {
          code: normalizeCourseCode("CSI 2110"),
          sections: [
            {
              name: "Ada Lovelace",
              professorRef: 0,
              termId: 2201,
              section: "",
              distribution: { "A+": 10, A: 20, B: 30, F: 5 },
            },
          ],
        },
      ],
    },
    catalogue: {
      courses: [
        {
          code: normalizeCourseCode("CSI 2110"),
          title: "Data Structures and Algorithms",
          credits: 3,
          description: "",
        },
        {
          code: normalizeCourseCode("MAT 1341"),
          title: "Introduction to Linear Algebra",
          credits: 3,
          description: "",
        },
      ],
      programs: [
        {
          title: "Honours BSc Computer Science",
          url: "https://catalogue.uottawa.ca/en/undergrad/honours-bsc-computer-science/",
          slug: "undergrad/honours-bsc-computer-science",
          requirements: [
            { type: "course", code: "CSI 2110", title: "Core computing" },
            {
              type: "group",
              title: "Mathematics",
              options: [{ type: "course", code: "MAT 1341" }],
            },
            { type: "free_elective", credits: 3, title: "Electives" },
          ],
        },
      ],
    },
    professors: [],
    ratings: {},
  };
}

describe("program detail view-model", () => {
  beforeEach(() => {
    jest.mocked(useRouter).mockReturnValue({
      back: jest.fn(),
      push: jest.fn(),
    } as never);
    jest.mocked(useLocalSearchParams).mockReturnValue({
      slug: ["undergrad", "honours-bsc-computer-science"],
    });
  });

  it("normalizes Expo catch-all slug params", () => {
    expect(parseProgramSlugParam(["undergrad", "honours-bsc-computer-science"])).toBe(
      "undergrad/honours-bsc-computer-science",
    );
    expect(parseProgramSlugParam("/undergrad/honours-bsc-computer-science/")).toBe(
      "undergrad/honours-bsc-computer-science",
    );
    expect(parseProgramSlugParam([])).toBeNull();
  });

  it("resolves a program and its concrete required courses", () => {
    const bundle = makeBundle();
    const index = buildExploreIndex(bundle);

    const detail = programDetail(bundle, index, ["undergrad", "honours-bsc-computer-science"]);

    expect(detail?.program.title).toBe("Honours BSc Computer Science");
    expect(detail?.coreCourses.map((course) => [course.code, course.title])).toEqual([
      ["CSI 2110", "Data Structures and Algorithms"],
      ["MAT 1341", "Introduction to Linear Algebra"],
    ]);
    expect(
      detail?.coreCourses.find((course) => course.code === "CSI 2110")?.gradeViz,
    ).not.toBeNull();
    expect(detail?.coreCourses.find((course) => course.code === "MAT 1341")?.gradeViz).toBeNull();
    expect(detail?.requirementCount).toBe(3);
  });

  it("renders core courses as expandable rows with a no-grade-data affordance", async () => {
    const bundle = makeBundle();
    const index = buildExploreIndex(bundle);
    jest.mocked(useAppData).mockReturnValue({ bundle, index } as never);

    const { getByRole, getByText, queryByText } = await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <ProgramDetailScreen />
      </SafeAreaProvider>,
    );

    expect(getByText("Honours BSc Computer Science")).toBeTruthy();
    expect(getByText("Official catalogue page")).toBeTruthy();
    expect(getByText("3 requirement rows")).toBeTruthy();
    expect(getByText("CSI 2110")).toBeTruthy();
    expect(getByText("MAT 1341")).toBeTruthy();
    expect(queryByText("No grade data yet.")).toBeNull();

    fireEvent.press(getByRole("button", { name: /MAT 1341/u }));

    await waitFor(() => expect(getByText("No grade data yet.")).toBeTruthy());
  });
});
