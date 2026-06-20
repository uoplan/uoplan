import { render } from "@testing-library/react-native";

import { PersonalizeRequirementsReadoutView } from "@/components/personalize-requirements-readout";
import type { PersonalizeRequirementsReadout } from "@/lib/personalize-requirements";

describe("PersonalizeRequirementsReadoutView", () => {
  it("shows the remaining banner and outstanding blocks", async () => {
    const readout: PersonalizeRequirementsReadout = {
      programTitle: "Test program",
      remainingCount: 2,
      unassignedCompletedCourses: [],
      remaining: [
        {
          requirementId: "0",
          type: "discipline_elective",
          title: "3 optional course units in English (ENG)",
          candidateCourses: ["ENG 1100", "ENG 2100"],
          creditsNeeded: 3,
          satisfiedBy: [],
        },
        {
          requirementId: "1",
          type: "group",
          candidateCourses: ["CSI 3110"],
          satisfiedBy: [],
        },
      ],
      completed: [{ title: "Compulsory courses", satisfiedBy: ["CSI 2110", "CSI 2120"] }],
    };

    const { getByText } = await render(<PersonalizeRequirementsReadoutView readout={readout} />);

    expect(getByText("2 requirements remaining")).toBeTruthy();
    expect(getByText("3 optional course units in English (ENG)")).toBeTruthy();
    expect(getByText("Completed (1)")).toBeTruthy();
    expect(getByText("CSI 2110, CSI 2120")).toBeTruthy();
  });

  it("shows the all-met banner when nothing is outstanding", async () => {
    const readout: PersonalizeRequirementsReadout = {
      programTitle: "Test program",
      remainingCount: 0,
      unassignedCompletedCourses: [],
      remaining: [],
      completed: [{ title: "Compulsory courses", satisfiedBy: ["CSI 2110"] }],
    };

    const { getByText } = await render(<PersonalizeRequirementsReadoutView readout={readout} />);

    expect(getByText("All program requirements met")).toBeTruthy();
  });
});
