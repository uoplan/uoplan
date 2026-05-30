import { describe, expect, it } from "vitest";
import type { ComponentSection } from "../../dataTypes";
import type { CourseEnrollment, GenerationConstraints } from "../../generation";
import {
  ConstraintPipeline,
  blacklistConstraint,
  compressedScheduleConstraint,
  minProfessorRatingConstraint,
  overlapConstraint,
  timeWindowConstraint,
  type Constraint,
  type ConstraintContext,
  type CourseSetCtx,
  type RejectionTrace,
} from "./index";
import { buildFixtureCache } from "../../generation/tests/golden/fixtures";

const cache = buildFixtureCache();
const ctx: ConstraintContext = {
  cache,
  completed: new Set(),
  prereqEligible: new Set(),
};
const setCtx: CourseSetCtx = { ...ctx, requirementTypeById: new Map() };

function section(times: ComponentSection["times"]): ComponentSection {
  return { section: "A", sectionCode: "A", component: "LEC", session: null, status: null, times };
}

const FULL_DAY: GenerationConstraints = {
  minStartMinutes: 0,
  maxEndMinutes: 24 * 60,
  allowedDays: [],
};

describe("ConstraintPipeline routing", () => {
  it("drops inert constraints", () => {
    const inert: Constraint = { id: "x", label: "x", active: false, allowsCourse: () => false };
    const p = new ConstraintPipeline([inert]);
    expect(p.active).toHaveLength(0);
    expect(p.allowsCourse("CSI 2110", ctx)).toBe(true);
  });

  it("short-circuits and records the rejecting constraint", () => {
    const p = new ConstraintPipeline([blacklistConstraint(["CSI 2110"])]);
    const traces: RejectionTrace[] = [];
    expect(p.allowsCourse("CSI 2110", ctx, (t) => traces.push(t))).toBe(false);
    expect(p.allowsCourse("CSI 2120", ctx)).toBe(true);
    expect(traces).toEqual([{ scope: "course", constraintId: "blacklist", subject: "CSI 2110" }]);
  });

  it("normalises codes for the blacklist", () => {
    const p = new ConstraintPipeline([blacklistConstraint(["csi2110"])]);
    expect(p.allowsCourse("CSI 2110", ctx)).toBe(false);
  });

  it("`without` removes a single constraint for relaxation", () => {
    const p = new ConstraintPipeline([blacklistConstraint(["CSI 2110"])]);
    expect(p.without("blacklist").allowsCourse("CSI 2110", ctx)).toBe(true);
  });
});

describe("section-scope constraints", () => {
  it("time window rejects sections outside the allowed window", () => {
    const c = timeWindowConstraint({ ...FULL_DAY, minStartMinutes: 660 });
    expect(c.active).toBe(true);
    const early = section([{ day: "Mo", startMinutes: 600, endMinutes: 690, virtual: false }]);
    const late = section([{ day: "Mo", startMinutes: 720, endMinutes: 810, virtual: false }]);
    expect(c.allowsSection?.("CSI 2110", early, ctx)).toBe(false);
    expect(c.allowsSection?.("CSI 2110", late, ctx)).toBe(true);
  });

  it("time window is inert when the window is unrestricted", () => {
    expect(timeWindowConstraint(FULL_DAY).active).toBe(false);
  });

  it("min professor rating gates on the ratings map", () => {
    const c = minProfessorRatingConstraint({
      ...FULL_DAY,
      minProfessorRating: 4,
      professorRatings: { "Jane Doe": { rating: 3, numRatings: 10 } },
    });
    const s = section([
      { day: "Mo", startMinutes: 600, endMinutes: 690, virtual: false, instructor: "Jane Doe" },
    ]);
    expect(c.allowsSection?.("CSI 2110", s, ctx)).toBe(false);
  });
});

describe("timetable-scope constraints", () => {
  const mk = (
    day: CourseEnrollment["times"][number]["day"],
    s: number,
    e: number,
  ): CourseEnrollment => ({
    courseCode: "X",
    sectionCombo: {},
    times: [{ day, startMinutes: s, endMinutes: e }],
  });

  it("overlap rejects time clashes incrementally", () => {
    const a = mk("Mo", 600, 690);
    const b = mk("Mo", 660, 750);
    const c = mk("Tu", 600, 690);
    expect(overlapConstraint.allowsEnrollment?.(b, [a], ctx)).toBe(false);
    expect(overlapConstraint.allowsEnrollment?.(c, [a], ctx)).toBe(true);
  });

  it("compressed constraint is inert unless enabled", () => {
    expect(compressedScheduleConstraint(FULL_DAY).active).toBe(false);
    expect(compressedScheduleConstraint({ ...FULL_DAY, compressedSchedule: true }).active).toBe(
      true,
    );
  });
});

describe("ordering weights", () => {
  it("multiplies soft weights, treating non-positive as neutral", () => {
    const a: Constraint = { id: "a", label: "a", active: true, orderingWeight: () => 2 };
    const b: Constraint = { id: "b", label: "b", active: true, orderingWeight: () => 3 };
    const zero: Constraint = { id: "z", label: "z", active: true, orderingWeight: () => 0 };
    expect(new ConstraintPipeline([a, b, zero]).orderingWeight("CSI 2110", ctx)).toBe(6);
  });

  it("course-set candidate routing works", () => {
    const onlyCsi: Constraint = {
      id: "onlyCsi",
      label: "onlyCsi",
      active: true,
      allowsCandidate: (code) => code.startsWith("CSI"),
    };
    const p = new ConstraintPipeline([onlyCsi]);
    expect(p.allowsCandidate("CSI 2110", setCtx)).toBe(true);
    expect(p.allowsCandidate("MAT 1320", setCtx)).toBe(false);
  });
});
