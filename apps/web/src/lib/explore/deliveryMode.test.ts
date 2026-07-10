import type { CourseSchedule, NormalizedCourseCode, SchedulesData } from "@uoplan/core";
import { buildAliasGroups, resolveComponentId } from "@uoplan/core/courseAlias";
import { describe, expect, it } from "vitest";
import { testCourseCode } from "../../test/brands";
import {
  buildExploreDeliveryPresenceIndex,
  deliverySetsForTerm,
  EMPTY_EXPLORE_DELIVERY_PRESENCE,
} from "./deliveryMode";

function meeting(virtual: boolean) {
  return {
    day: "Mo" as const,
    startMinutes: 600,
    endMinutes: 690,
    virtual,
    instructor: null,
  };
}

function section(times: CourseSchedule["components"][string][number]["times"]) {
  return {
    section: "A00",
    sectionCode: "A00",
    component: "LEC",
    session: null,
    times,
    status: null,
  } satisfies CourseSchedule["components"][string][number];
}

function schedule(code: string, components: CourseSchedule["components"]): CourseSchedule {
  const [subject, catalogNumber] = code.split(/\s+/);
  return {
    subject,
    catalogNumber,
    courseCode: testCourseCode(code),
    title: code,
    timeZone: "America/Toronto",
    components,
  };
}

function term(termId: string, ...schedules: CourseSchedule[]): SchedulesData {
  return { termId, schedules };
}

function buildIndex(
  allSchedules: SchedulesData[],
  componentByNorm = new Map<NormalizedCourseCode, NormalizedCourseCode>(),
) {
  return buildExploreDeliveryPresenceIndex(allSchedules, componentByNorm);
}

function setOf(...codes: string[]) {
  return new Set(codes.map(testCourseCode));
}

type EmptyReadonlySet<T> = ReadonlySet<T> & {
  readonly add?: unknown;
  readonly delete?: unknown;
  readonly clear?: unknown;
};

function expectDeliverySets(
  index: ReturnType<typeof buildIndex>,
  termId: number | null,
  virtualCodes: string[],
  inPersonCodes: string[],
) {
  const sets = deliverySetsForTerm(index, termId);
  expect(sets.virtual).toEqual(setOf(...virtualCodes));
  expect(sets.inPerson).toEqual(setOf(...inPersonCodes));
}

describe("buildExploreDeliveryPresenceIndex", () => {
  it("isolates EMPTY_EXPLORE_DELIVERY_PRESENCE from hostile mutation", () => {
    const virtual = EMPTY_EXPLORE_DELIVERY_PRESENCE.virtualComponents as Set<NormalizedCourseCode>;
    virtual.add(testCourseCode("CSI 2110"));

    expect(EMPTY_EXPLORE_DELIVERY_PRESENCE.virtualComponents).toEqual(setOf());
    expect(EMPTY_EXPLORE_DELIVERY_PRESENCE.virtualComponents).not.toBe(virtual);
  });

  it("isolates returned delivery index collections from hostile runtime mutation", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
    ]);

    const virtual = index.virtualComponents as Set<NormalizedCourseCode>;
    const inPerson = index.inPersonComponents as Set<NormalizedCourseCode>;
    const perTerm = index.virtualComponentsByTerm.get(2269) as Set<NormalizedCourseCode>;

    virtual.add(testCourseCode("MAT 1341"));
    inPerson.add(testCourseCode("PHY 1121"));
    perTerm.add(testCourseCode("CHM 1311"));

    expect(index.virtualComponents).toEqual(setOf("CSI 2110"));
    expect(index.inPersonComponents).toEqual(setOf());
    expect(index.virtualComponentsByTerm.get(2269)).toEqual(setOf("CSI 2110"));
    expect(deliverySetsForTerm(index, 2269).virtual).toEqual(setOf("CSI 2110"));
    expect(deliverySetsForTerm(index, 2269).inPerson).toEqual(setOf());
  });

  it("exposes an immutable stable empty set for missing terms", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
    ]);

    const absent = deliverySetsForTerm(index, 9999);
    const absentVirtual = absent.virtual as EmptyReadonlySet<NormalizedCourseCode>;
    const absentInPerson = absent.inPerson as EmptyReadonlySet<NormalizedCourseCode>;

    expect(absent.virtual).toBe(deliverySetsForTerm(index, 9999).virtual);
    expect(absent.inPerson).toBe(deliverySetsForTerm(index, 9999).inPerson);
    expect(absent.virtual.size).toBe(0);
    expect(absent.inPerson.size).toBe(0);
    expect(absentVirtual.add).toBeUndefined();
    expect(absentInPerson.delete).toBeUndefined();
    expect(absentVirtual.clear).toBeUndefined();
  });

  it("indexes virtual-only sections", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
    ]);

    expectDeliverySets(index, 2269, ["CSI 2110"], []);
    expect(index.virtualComponents).toEqual(setOf("CSI 2110"));
    expect(index.inPersonComponents).toEqual(setOf());
  });

  it("indexes in-person-only sections", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(false)])] })),
    ]);

    expectDeliverySets(index, 2269, [], ["CSI 2110"]);
  });

  it("indexes mixed delivery sections in both modes", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true), meeting(false)])] })),
    ]);

    expectDeliverySets(index, 2269, ["CSI 2110"], ["CSI 2110"]);
  });

  it("ignores sections without meeting times", () => {
    const index = buildIndex([term("2269", schedule("CSI 2110", { LEC: [section([])] }))]);

    expectDeliverySets(index, 2269, [], []);
  });

  it("keeps separate per-term maps", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
      term("2261", schedule("CSI 2110", { LEC: [section([meeting(false)])] })),
    ]);

    expectDeliverySets(index, 2269, ["CSI 2110"], []);
    expectDeliverySets(index, 2261, [], ["CSI 2110"]);
  });

  it("builds all-term unions", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
      term("2261", schedule("CSI 2110", { LEC: [section([meeting(false)])] })),
    ]);

    expectDeliverySets(index, null, ["CSI 2110"], ["CSI 2110"]);
  });

  it("returns copied delivery sets for populated terms", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
    ]);

    const sets = deliverySetsForTerm(index, 2269);
    (sets.virtual as Set<NormalizedCourseCode>).add(testCourseCode("MAT 1341"));

    expect(deliverySetsForTerm(index, 2269).virtual).toEqual(setOf("CSI 2110"));
    expect(index.virtualComponentsByTerm.get(2269)).toEqual(setOf("CSI 2110"));
    expect(index.virtualComponents).toEqual(setOf("CSI 2110"));
  });

  it("returns copied delivery sets for the all-term union", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
      term("2261", schedule("CSI 2110", { LEC: [section([meeting(false)])] })),
    ]);

    const sets = deliverySetsForTerm(index, null);
    (sets.virtual as Set<NormalizedCourseCode>).add(testCourseCode("MAT 1341"));
    (sets.inPerson as Set<NormalizedCourseCode>).add(testCourseCode("PHY 1121"));

    expect(deliverySetsForTerm(index, null).virtual).toEqual(setOf("CSI 2110"));
    expect(deliverySetsForTerm(index, null).inPerson).toEqual(setOf("CSI 2110"));
    expect(index.virtualComponents).toEqual(setOf("CSI 2110"));
    expect(index.inPersonComponents).toEqual(setOf("CSI 2110"));
  });

  it("propagates alias resolution onto the canonical component id", () => {
    const { componentByNorm } = buildAliasGroups({
      courses: [
        {
          code: testCourseCode("MAT 2371"),
          title: "Statistics",
          credits: 3,
          description: "",
          aliases: [testCourseCode("STA 2391")],
        },
      ],
      programs: [],
    });
    const index = buildIndex(
      [term("2269", schedule("STA 2391", { LEC: [section([meeting(true)])] }))],
      componentByNorm,
    );
    const componentId = resolveComponentId(testCourseCode("STA 2391"), componentByNorm);

    expectDeliverySets(index, null, ["MAT 2371"], []);
    expect(componentId).toBe(resolveComponentId(testCourseCode("MAT 2371"), componentByNorm));
  });

  it("skips invalid term ids", () => {
    const index = buildIndex([
      term("2269", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
      term("not-a-term", schedule("MAT 1341", { LEC: [section([meeting(false)])] })),
    ]);

    expectDeliverySets(index, null, ["CSI 2110"], []);
    expectDeliverySets(index, 2269, ["CSI 2110"], []);

    const absent = deliverySetsForTerm(index, 9999);
    expect(absent.virtual).toBe(deliverySetsForTerm(index, 9999).virtual);
    expect(absent.inPerson).toBe(deliverySetsForTerm(index, 9999).inPerson);
  });

  it("skips the decoded invalid schedule term sentinel", () => {
    const index = buildIndex([
      term("0", schedule("CSI 2110", { LEC: [section([meeting(true)])] })),
    ]);

    expectDeliverySets(index, 0, [], []);
  });
});
