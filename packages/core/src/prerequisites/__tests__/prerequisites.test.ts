import { describe, expect, it, beforeEach } from "vitest";
import type { DataCache } from "../../dataCache";
import { buildPrereqContext } from "../context";
import type { Course } from "../../dataTypes";
import { meetsCoursePrereq, canTakeCourse, prerequisitesContainNonCourse } from "../evaluator";
import type { CoursePrereqNode } from "../../dataTypes";

describe("prerequisites", () => {
  let mockCache: DataCache;

  beforeEach(() => {
    const courseA: Course = { code: "AAA 1000", credits: 3, title: "A", description: "" };
    const courseB: Course = {
      code: "BBB 2000",
      credits: 3,
      title: "B",
      description: "",
      prerequisites: { type: "course", code: "AAA 1000" },
    };
    const courses = [courseA, courseB];
    mockCache = {
      getCourse: (c) => courses.find((x) => x.code === c) || undefined,
      resolveToCanonical: (c) => c,
      getAllCourses: () => courses,
      getCoursesByDiscipline: () => [],
      getSchedule: () => undefined,
      getAllSchedules: () => [],
    };
  });

  describe("context", () => {
    it("builds context with total credits", () => {
      const ctx = buildPrereqContext(["AAA 1000", "BBB 2000"], mockCache);
      expect(ctx.totalCredits).toBe(6);
      expect(ctx.taken.length).toBe(2);
      expect(ctx.disciplineCredits["AAA"]).toBe(3);
    });
  });

  describe("evaluator", () => {
    it("can take course with met prereq", () => {
      const ctx = buildPrereqContext(["AAA 1000"], mockCache);
      expect(canTakeCourse("BBB 2000", mockCache, ctx)).toBe(true);
    });

    it("cannot take course without met prereq", () => {
      const ctx = buildPrereqContext([], mockCache);
      expect(canTakeCourse("BBB 2000", mockCache, ctx)).toBe(false);
    });

    it("evaluates non_course level requirement", () => {
      const ctx = buildPrereqContext(["AAA 1000"], mockCache);
      const req: CoursePrereqNode = {
        type: "non_course",
        credits: 3,
        levels: [1000],
      };
      expect(meetsCoursePrereq(req, ctx)).toBe(true);

      const reqFail: CoursePrereqNode = {
        type: "non_course",
        credits: 3,
        levels: [2000],
      };
      expect(meetsCoursePrereq(reqFail, ctx)).toBe(false);
    });

    describe("non_course kind semantics", () => {
      it("treats a soft kind (permission) as satisfiable at the root", () => {
        const ctx = buildPrereqContext([], mockCache);
        const req: CoursePrereqNode = {
          type: "non_course",
          kind: "permission",
          text: "Permission of the Department",
        };
        expect(meetsCoursePrereq(req, ctx)).toBe(true);
      });

      it.each([
        "permission",
        "audition",
        "language",
        "highschool",
        "recommended",
        "topic",
      ] as const)("treats soft kind %s as satisfiable", (kind) => {
        const ctx = buildPrereqContext([], mockCache);
        expect(meetsCoursePrereq({ type: "non_course", kind }, ctx)).toBe(true);
      });

      it.each(["standing", "coursework", "knowledge", "equivalent"] as const)(
        "keeps conservative kind %s blocking",
        (kind) => {
          const ctx = buildPrereqContext([], mockCache);
          expect(meetsCoursePrereq({ type: "non_course", kind }, ctx)).toBe(false);
        },
      );

      it("keeps an unclassified opaque non_course blocking", () => {
        const ctx = buildPrereqContext([], mockCache);
        expect(meetsCoursePrereq({ type: "non_course", text: "something" }, ctx)).toBe(false);
      });

      it("does not let a soft kind block a conjunction", () => {
        const ctx = buildPrereqContext(["AAA 1000"], mockCache);
        const req: CoursePrereqNode = {
          type: "and_group",
          children: [
            { type: "course", code: "AAA 1000" },
            { type: "non_course", kind: "permission" },
          ],
        };
        expect(meetsCoursePrereq(req, ctx)).toBe(true);
      });

      it("does not let a soft kind trivially satisfy a disjunction", () => {
        // "AAA 1000 or permission" must still require AAA 1000 when not taken.
        const ctx = buildPrereqContext([], mockCache);
        const req: CoursePrereqNode = {
          type: "or_group",
          children: [
            { type: "course", code: "AAA 1000" },
            { type: "non_course", kind: "permission" },
          ],
        };
        expect(meetsCoursePrereq(req, ctx)).toBe(false);

        const ctxWith = buildPrereqContext(["AAA 1000"], mockCache);
        expect(meetsCoursePrereq(req, ctxWith)).toBe(true);
      });
    });

    describe("prerequisitesContainNonCourse", () => {
      it("ignores soft-kind non_course nodes", () => {
        expect(prerequisitesContainNonCourse({ type: "non_course", kind: "permission" })).toBe(
          false,
        );
      });

      it("flags conservative and credit-pool non_course nodes", () => {
        expect(prerequisitesContainNonCourse({ type: "non_course", kind: "standing" })).toBe(true);
        expect(prerequisitesContainNonCourse({ type: "non_course", credits: 12 })).toBe(true);
        expect(prerequisitesContainNonCourse({ type: "non_course", text: "x" })).toBe(true);
      });
    });
  });
});
