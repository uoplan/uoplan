import { fireEvent, render } from "@testing-library/react-native";

import { normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";

import {
  CourseResultCard,
  DisciplineResultCard,
  FacultyResultCard,
  ProfessorResultCard,
  ProgramResultCard,
} from "@/components/explore-cards";

const viz = normalizeGradeVizDistribution({ "A+": 40, B: 30, F: 30 })!;

describe("explore result cards", () => {
  it("renders a course card with code, title, stat and fires onPress", async () => {
    const onPress = jest.fn();
    const { getByText } = await render(
      <CourseResultCard
        course={{
          code: "ITI 1120",
          title: "Intro to Computing",
          discipline: "ITI",
          distribution: {},
          gradeViz: viz,
          gpa: 6.2,
          graded: 100,
          failRate: 0.3,
          termIds: [],
        }}
        stat="gpa"
        onPress={onPress}
      />,
    );
    expect(getByText("ITI 1120")).toBeTruthy();
    expect(getByText("Intro to Computing")).toBeTruthy();
    expect(getByText("6.2 avg")).toBeTruthy();
    fireEvent.press(getByText("ITI 1120"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("renders a professor card with rating and graded count", async () => {
    const { getByText } = await render(
      <ProfessorResultCard
        professor={{
          slug: "ada-lovelace",
          name: "Ada Lovelace",
          rating: 4.5,
          numRatings: 12,
          graded: 200,
          gpa: 7.1,
          gradeViz: viz,
          termIds: [],
          disciplines: [],
        }}
      />,
    );
    expect(getByText("Ada Lovelace")).toBeTruthy();
    expect(getByText("4.5")).toBeTruthy();
    expect(getByText("200 grades")).toBeTruthy();
  });

  it("renders discipline, faculty and program cards", async () => {
    const { getByText } = await render(
      <>
        <DisciplineResultCard
          discipline={{
            code: "ITI",
            name: "Computer Science",
            courseCount: 12,
            graded: 5,
            gradeViz: viz,
          }}
        />
        <FacultyResultCard
          faculty={{
            id: "engineering",
            name: "Faculty of Engineering",
            disciplineCount: 6,
            graded: 5,
            gradeViz: viz,
          }}
        />
        <ProgramResultCard program={{ title: "Computer Science", url: "https://x", slug: "cs" }} />
      </>,
    );
    expect(getByText("ITI")).toBeTruthy();
    expect(getByText("12 courses")).toBeTruthy();
    expect(getByText("Faculty of Engineering")).toBeTruthy();
    expect(getByText("6 disciplines")).toBeTruthy();
    expect(getByText("PROGRAM")).toBeTruthy();
  });
});
