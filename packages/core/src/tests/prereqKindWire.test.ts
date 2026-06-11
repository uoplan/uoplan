import { describe, expect, it } from "vitest";

import { Catalogue as ProtoCatalogue, CoursePrereqKind } from "@uoplan/proto/data";

import type { Catalogue, CoursePrereqKind as DomainKind } from "../dataTypes";
import { fromProtoCatalogue, toProtoCatalogue } from "../dataTypes";
import { normalizeCourseCode } from "../utils/courseUtils";

const ALL_KINDS: DomainKind[] = [
  "permission",
  "audition",
  "language",
  "equivalent",
  "highschool",
  "standing",
  "topic",
  "coursework",
  "knowledge",
  "recommended",
];

/**
 * The `kind` annotation on opaque `non_course` prerequisites is part of the
 * committed `.pb` wire format. This pins the enum numbering and verifies a full
 * object -> proto -> binary -> proto -> object round-trip preserves every kind.
 */
describe("course-prereq kind wire contract", () => {
  it("pins data.proto CoursePrereqKind numbering (append-only)", () => {
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_UNSPECIFIED).toBe(0);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_PERMISSION).toBe(1);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_AUDITION).toBe(2);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_LANGUAGE).toBe(3);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_EQUIVALENT).toBe(4);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_HIGHSCHOOL).toBe(5);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_STANDING).toBe(6);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_TOPIC).toBe(7);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_COURSEWORK).toBe(8);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_KNOWLEDGE).toBe(9);
    expect(CoursePrereqKind.COURSE_PREREQ_KIND_RECOMMENDED).toBe(10);
  });

  it("round-trips every kind through proto + binary encoding", () => {
    const catalogue: Catalogue = {
      courses: ALL_KINDS.map((kind, i) => ({
        code: normalizeCourseCode(`XXX ${1000 + i}`),
        title: `Course ${kind}`,
        credits: 3,
        description: "",
        prerequisites: { type: "non_course", text: kind, kind },
      })),
      programs: [],
    };

    const wire = ProtoCatalogue.encode(toProtoCatalogue(catalogue)).finish();
    const decoded = fromProtoCatalogue(ProtoCatalogue.decode(wire));

    expect(decoded.courses).toHaveLength(ALL_KINDS.length);
    for (let i = 0; i < ALL_KINDS.length; i++) {
      expect(decoded.courses[i].prerequisites?.kind).toBe(ALL_KINDS[i]);
    }
  });

  it("omits kind for unannotated non_course nodes", () => {
    const catalogue: Catalogue = {
      courses: [
        {
          code: normalizeCourseCode("XXX 2000"),
          title: "No kind",
          credits: 3,
          description: "",
          prerequisites: { type: "non_course", text: "opaque" },
        },
      ],
      programs: [],
    };

    const wire = ProtoCatalogue.encode(toProtoCatalogue(catalogue)).finish();
    const decoded = fromProtoCatalogue(ProtoCatalogue.decode(wire));
    expect(decoded.courses[0].prerequisites?.kind).toBeUndefined();
  });
});
