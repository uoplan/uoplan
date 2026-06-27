import type { Catalogue, Program, SchedulesData } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import {
  clearSelectedOptionForRequirement,
  computePersonalizeRequirements,
  DEFAULT_REQUIREMENT_SELECTIONS,
  hasMissingProgramOptions,
  programHasOptionGroups,
  setSelectedOptionForRequirement,
  toggleRequirementCourse,
} from "@/lib/personalize-requirements";

const PROGRAM_URL = "https://example.com/options-program";

function course(code: string, title = code) {
  return {
    code: normalizeCourseCode(code),
    title,
    credits: 3,
    description: "",
    component: "LEC",
  };
}

const program: Program = {
  title: "Options program",
  url: PROGRAM_URL,
  requirements: [
    {
      type: "or_group",
      title: "Choose one science stream",
      options: [
        {
          type: "course",
          title: "Math stream",
          code: normalizeCourseCode("MAT 1320"),
          credits: 3,
        },
        {
          type: "course",
          title: "Physics stream",
          code: normalizeCourseCode("PHY 1121"),
          credits: 3,
        },
      ],
    },
    {
      type: "discipline_elective",
      title: "3 optional course units in computer science",
      disciplineLevels: [{ discipline: "CSI" }],
      credits: 3,
    },
  ],
};

const catalogue: Catalogue = {
  courses: [
    course("MAT 1320", "Calculus I"),
    course("PHY 1121", "Fundamentals of Physics I"),
    course("CSI 2110", "Data structures"),
  ],
  programs: [program],
};

const schedules: SchedulesData = { termId: "2261", schedules: [] };

describe("native personalize requirement selections", () => {
  it("threads selected option branches into the shared core requirements evaluator", () => {
    const base = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: [],
      selections: DEFAULT_REQUIREMENT_SELECTIONS,
    });
    expect(base).not.toBeNull();
    expect(base!.remaining.flatMap((req) => req.candidateCourses)).toContain("MAT 1320");

    const selections = setSelectedOptionForRequirement(DEFAULT_REQUIREMENT_SELECTIONS, "req-0", 1);
    const readout = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: [],
      selections,
    });

    expect(readout).not.toBeNull();
    expect(readout!.selectedOptionsPerRequirement).toEqual({ "req-0": 1 });
    expect(readout!.remaining.flatMap((req) => req.candidateCourses)).toContain("PHY 1121");
    expect(
      readout!
        .requirementTreeWithStatus!.find((node) => node.requirementId === "req-0")
        ?.options?.find((node) => node.requirementId === "req-0-1")?.candidateCourses,
    ).toEqual(["PHY 1121"]);
  });

  it("flags an unresolved option group and clears once a branch is chosen", () => {
    const unselected = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: [],
      selections: DEFAULT_REQUIREMENT_SELECTIONS,
    });
    expect(unselected).not.toBeNull();
    const tree = unselected!.requirementTreeWithStatus ?? [];
    expect(programHasOptionGroups(tree)).toBe(true);
    expect(hasMissingProgramOptions(tree, {})).toBe(true);

    const selections = setSelectedOptionForRequirement(DEFAULT_REQUIREMENT_SELECTIONS, "req-0", 1);
    const selected = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: [],
      selections,
    });
    expect(selected).not.toBeNull();
    expect(
      hasMissingProgramOptions(
        selected!.requirementTreeWithStatus ?? [],
        selections.selectedOptionsPerRequirement,
      ),
    ).toBe(false);
  });

  it("clears descendant option choices when an option group is cleared", () => {
    const selected = setSelectedOptionForRequirement(
      {
        ...DEFAULT_REQUIREMENT_SELECTIONS,
        selectedOptionsPerRequirement: { "req-0": 1, "req-0-1": 0, "req-1": 0 },
      },
      "req-0",
      1,
    );

    const cleared = clearSelectedOptionForRequirement(selected, "req-0");

    expect(cleared.selectedOptionsPerRequirement).toEqual({ "req-1": 0 });
  });

  it("toggles assigned and pinned courses without duplicating normalized codes", () => {
    const assigned = toggleRequirementCourse(
      DEFAULT_REQUIREMENT_SELECTIONS,
      "req-1",
      "csi 2110",
      "assigned",
    );
    const assignedAgain = toggleRequirementCourse(assigned, "req-1", "CSI 2110", "assigned");
    const pinned = toggleRequirementCourse(assignedAgain, "req-1", "CSI 2110", "pinned");
    const pinnedDuplicate = toggleRequirementCourse(pinned, "req-1", "csi 2110", "pinned");

    expect(assigned.selectedPerRequirement["req-1"]).toEqual(["CSI 2110"]);
    expect(assignedAgain.selectedPerRequirement["req-1"]).toBeUndefined();
    expect(pinned.constrainedPerRequirement["req-1"]).toEqual(["CSI 2110"]);
    expect(pinnedDuplicate.constrainedPerRequirement["req-1"]).toBeUndefined();
  });

  it("auto-assigns a completed elective candidate without manual selection", () => {
    const selections = setSelectedOptionForRequirement(DEFAULT_REQUIREMENT_SELECTIONS, "req-0", 0);
    const readout = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: ["CSI 2110"],
      selections,
    });
    expect(readout).not.toBeNull();
    // Mirrors the web planner: the completed elective is placed automatically, so
    // nothing is left for the student to assign and the slot is filled.
    expect(readout!.unassignedCompletedCourses).toEqual([]);
    expect(readout!.selectedPerRequirement?.["req-1"]).toContain(normalizeCourseCode("CSI 2110"));
  });

  it("keeps a manual assignment override and leaves nothing unassigned", () => {
    const selections = setSelectedOptionForRequirement(DEFAULT_REQUIREMENT_SELECTIONS, "req-0", 0);
    const assigned = toggleRequirementCourse(selections, "req-1", "CSI 2110", "assigned");
    const afterAssign = computePersonalizeRequirements({
      catalogue,
      schedules,
      programUrl: PROGRAM_URL,
      completedCourses: ["CSI 2110"],
      selections: assigned,
    });
    expect(afterAssign).not.toBeNull();
    expect(afterAssign!.unassignedCompletedCourses).toEqual([]);
    expect(afterAssign!.selectedPerRequirement?.["req-1"]).toContain(
      normalizeCourseCode("CSI 2110"),
    );
  });
});
