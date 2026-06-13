import { render } from "@testing-library/react-native";

import { normalizeGradeVizDistribution } from "@uoplan/core/gradeDistribution";

import { GradeHistogram } from "@/components/grade-histogram";

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
    expect(getByText("A+")).toBeTruthy();
    expect(getByText("S/NS")).toBeTruthy();
    // "F" appears for the merged Fail bar.
    expect(getAllByText("F").length).toBeGreaterThanOrEqual(1);
  });

  it("renders the passing/A+ summary line when enabled", async () => {
    const { getByText } = await render(<GradeHistogram gradeViz={gradeViz!} showSummary />);
    expect(getByText(/% passing/)).toBeTruthy();
  });
});
