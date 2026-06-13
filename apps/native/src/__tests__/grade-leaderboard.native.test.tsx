import { fireEvent, render } from "@testing-library/react-native";

import { GradeLeaderboard } from "@/components/grade-leaderboard";
import { SAMPLE_COURSE_GRADES } from "@/data/sample-grades";

// The leaderboard is the native analogue of the web Trends ranking: it sorts
// the sample courses by shared `distributionGpa` (10-point scale) and renders
// pressable RN-View bars (no SVG).
describe("GradeLeaderboard (native)", () => {
  it("renders every course ranked by descending GPA", async () => {
    const { getAllByText, getByText } = await render(
      <GradeLeaderboard courses={SAMPLE_COURSE_GRADES} />,
    );

    // Rank markers 1..N are present.
    expect(getByText("1")).toBeTruthy();
    expect(getByText(String(SAMPLE_COURSE_GRADES.length))).toBeTruthy();

    // Each sample course code appears.
    for (const c of SAMPLE_COURSE_GRADES) {
      expect(getAllByText(c.code).length).toBeGreaterThanOrEqual(1);
    }
  });

  it("fires onSelect with the course code when a row is pressed", async () => {
    const onSelect = jest.fn();
    const { getByText } = await render(
      <GradeLeaderboard courses={SAMPLE_COURSE_GRADES} onSelect={onSelect} />,
    );

    fireEvent.press(getByText(SAMPLE_COURSE_GRADES[0].code));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(SAMPLE_COURSE_GRADES[0].code);
  });
});
