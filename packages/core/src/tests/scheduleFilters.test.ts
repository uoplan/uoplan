import {
  cacheWithPerCourseVirtualFilter,
  filterScheduleExcludingClosed,
  filterScheduleVirtualOnly,
  getEffectiveSchedule,
} from "../scheduleFilters";
import type { CourseSchedule } from "../dataTypes";
import type { DataCache } from "../dataCache";
import { describe, expect, it } from "vitest";
import { normalizeCourseCode } from "../utils/courseUtils";

function makeSection(
  section: string,
  status: string | null,
  times: CourseSchedule["components"][string][number]["times"] = [
    { day: "Mo", startMinutes: 540, endMinutes: 630, virtual: false },
  ],
): CourseSchedule["components"][string][number] {
  return {
    section,
    sectionCode: section,
    component: "LEC",
    session: null,
    times,
    status,
  };
}

function makeSchedule(components: CourseSchedule["components"]): CourseSchedule {
  return {
    subject: "CSI",
    catalogNumber: "1234",
    courseCode: normalizeCourseCode("CSI 1234"),
    title: "Test",
    timeZone: "America/Toronto",
    components,
  };
}

function openSchedule(
  times: CourseSchedule["components"][string][number]["times"] = [
    { day: "Mo", startMinutes: 540, endMinutes: 630, virtual: false },
  ],
): CourseSchedule {
  return makeSchedule({
    LEC: [makeSection("A00", "Open", times)],
  });
}

function scheduleWithMixedVirtualTimes(): CourseSchedule {
  return openSchedule([
    { day: "Mo", startMinutes: 540, endMinutes: 630, virtual: false },
    { day: "We", startMinutes: 540, endMinutes: 630, virtual: true },
  ]);
}

function cacheReturning(
  schedule?: CourseSchedule,
  shouldReturnSchedule: (code: string) => boolean = () => true,
): DataCache {
  return {
    getCourse: () => {},
    resolveToCanonical: (code) => normalizeCourseCode(code),
    getSchedule: (code) => (schedule && shouldReturnSchedule(code) ? schedule : undefined),
    getCoursesByDiscipline: () => [],
    getAllCourses: () => [],
    getAllSchedules: () => (schedule ? [schedule] : []),
  };
}

function expectOnlyVirtualLectureTime(schedule: CourseSchedule | undefined) {
  expect(schedule).toBeDefined();
  expect(schedule?.components.LEC).toHaveLength(1);
  expect(schedule?.components.LEC[0].times).toHaveLength(1);
  expect(schedule?.components.LEC[0].times[0].virtual).toBe(true);
}

describe("filterScheduleExcludingClosed", () => {
  it("returns same schedule when all sections are open or non-closed", () => {
    const sched = openSchedule();
    const out = filterScheduleExcludingClosed(sched);
    expect(out).toBeDefined();
    expect(out?.components.LEC).toHaveLength(1);
    expect(out?.components.LEC[0].status).toBe("Open");
  });

  it("returns undefined when one component has only closed sections", () => {
    const sched = makeSchedule({
      LEC: [makeSection("A00", "Closed")],
    });
    const out = filterScheduleExcludingClosed(sched);
    expect(out).toBeUndefined();
  });

  it("filters out closed sections and keeps open in same component", () => {
    const sched = makeSchedule({
      LEC: [
        makeSection("A00", "Open"),
        makeSection("A01", "Closed", [
          { day: "Tu", startMinutes: 540, endMinutes: 630, virtual: false },
        ]),
      ],
    });
    const out = filterScheduleExcludingClosed(sched);
    expect(out).toBeDefined();
    expect(out?.components.LEC).toHaveLength(1);
    expect(out?.components.LEC[0].sectionCode).toBe("A00");
  });

  it("returns undefined when one of multiple components ends up empty", () => {
    const sched = makeSchedule({
      LEC: [makeSection("A00", "Open")],
      TUT: [
        {
          ...makeSection("T01", "Closed", [
            { day: "We", startMinutes: 540, endMinutes: 630, virtual: false },
          ]),
          component: "TUT",
        },
      ],
    });
    const out = filterScheduleExcludingClosed(sched);
    expect(out).toBeUndefined();
  });
});

describe("filterScheduleVirtualOnly", () => {
  it("keeps hybrid section with only virtual times remaining", () => {
    const sched = scheduleWithMixedVirtualTimes();
    const out = filterScheduleVirtualOnly(sched);
    expectOnlyVirtualLectureTime(out);
  });

  it("returns undefined when all times are non-virtual", () => {
    const sched = openSchedule();
    expect(filterScheduleVirtualOnly(sched)).toBeUndefined();
  });

  it("returns undefined when one component has no sections left after strip", () => {
    const sched = makeSchedule({
      LEC: [
        makeSection("A00", "Open", [
          { day: "Mo", startMinutes: 540, endMinutes: 630, virtual: true },
        ]),
      ],
      TUT: [
        {
          ...makeSection("T01", "Open", [
            { day: "We", startMinutes: 540, endMinutes: 630, virtual: false },
          ]),
          component: "TUT",
        },
      ],
    });
    expect(filterScheduleVirtualOnly(sched)).toBeUndefined();
  });
});

describe("getEffectiveSchedule", () => {
  const schedOpen = openSchedule();

  it("returns raw schedule when includeClosed is true", () => {
    const cache = cacheReturning(schedOpen);
    const out = getEffectiveSchedule(cache, normalizeCourseCode("CSI 1234"), true);
    expect(out).toBe(schedOpen);
  });

  it("returns undefined when code not in cache", () => {
    const cache = cacheReturning();
    const out = getEffectiveSchedule(cache, normalizeCourseCode("CSI 9999"), false);
    expect(out).toBeUndefined();
  });

  it("returns undefined when virtualOnly and no virtual times remain", () => {
    const schedNonVirtual = openSchedule();
    const cache = cacheReturning(schedNonVirtual);
    expect(
      getEffectiveSchedule(cache, normalizeCourseCode("CSI 1234"), true, true),
    ).toBeUndefined();
  });
});

describe("cacheWithPerCourseVirtualFilter", () => {
  it("applies virtual filtering per-code", () => {
    const schedBoth = scheduleWithMixedVirtualTimes();
    const cache = cacheReturning(schedBoth, (code) => code === normalizeCourseCode("CSI 1234"));

    const wrapped = cacheWithPerCourseVirtualFilter(
      cache,
      true,
      (code) => code === normalizeCourseCode("CSI 1234"),
    );

    const out = wrapped.getSchedule(normalizeCourseCode("CSI 1234"));
    expectOnlyVirtualLectureTime(out);
  });

  it("keeps non-virtual times when virtualOnly is false", () => {
    const schedBoth = scheduleWithMixedVirtualTimes();
    const cache = cacheReturning(schedBoth);

    const wrapped = cacheWithPerCourseVirtualFilter(cache, true, () => false);
    const out = wrapped.getSchedule(normalizeCourseCode("CSI 1234"));
    expect(out).toBeDefined();
    expect(out?.components.LEC[0].times).toHaveLength(2);
  });
});
