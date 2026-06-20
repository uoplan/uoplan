import { render } from "@testing-library/react-native";

import { normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";

import { GradeHistogram } from "@/components/grade-histogram";
import { GradeVizBar } from "@/components/grade-viz-bar";

// The native grade histogram is the RN leaf of the web GradeDistribution chart;
// both render the same shared model (buildGradeHistogramModel) + bucket colours.
describe("GradeHistogram (native)", () => {
  const gradeViz = normalizeGradeVizDistribution({
    "A+": 50,
    A: 30,
    B: 40,
    "C+": 20,
    D: 10,
    F: 15,
    DR: 8,
  });

  it("renders the merged Fail bar, letter labels and the S/NS bar", async () => {
    expect(gradeViz).not.toBeNull();
    const { getByText, getAllByText } = await render(<GradeHistogram gradeViz={gradeViz!} />);

    // DR (withdrew), merged Fail "F", a couple of letter bars, and the S/NS bar.
    expect(getByText("DR")).toBeTruthy();
    expect(getAllByText("A+").length).toBeGreaterThanOrEqual(1);
    expect(getByText("S/NS")).toBeTruthy();
    // "F" appears for the merged Fail bar.
    expect(getAllByText("F").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the compact stats header and special-grade legend", async () => {
    const { getByText, getAllByText } = await render(
      <GradeHistogram gradeViz={gradeViz!} showSummary showStudentCount />,
    );

    expect(getByText("Students")).toBeTruthy();
    expect(getByText("173")).toBeTruthy();
    expect(getByText("Passing")).toBeTruthy();
    expect(getByText("91%")).toBeTruthy();
    expect(getAllByText("A+").length).toBeGreaterThanOrEqual(1);
    expect(getByText("Median")).toBeTruthy();
    expect(getByText("DR withdrew")).toBeTruthy();
    expect(getByText("S/NS pass-fail")).toBeTruthy();
  });

  it("can render a one-line passing stat beside the compact bar", async () => {
    expect(gradeViz).not.toBeNull();
    const { getByText } = await render(<GradeVizBar gradeViz={gradeViz!} showInlineStat />);

    expect(getByText("91% passing")).toBeTruthy();
  });
});
