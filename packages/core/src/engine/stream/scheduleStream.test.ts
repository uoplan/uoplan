/**
 * End-to-end tests for the {@link ScheduleStream}: it must compose a course-set
 * source with the timetable enumerator to yield many DISTINCT, conflict-free,
 * deterministic timetables — the behaviour the legacy pipeline failed to.
 */
import { describe, it, expect } from "vitest";
import {
  buildFixtureCache,
  DEFAULT_CONSTRAINTS,
  ALL_FIXTURE_CODES,
} from "../../generation/tests/golden/fixtures";
import { createSeededRng } from "../../seededRandom";
import { enrollmentsOverlap } from "../../generation/overlaps";
import { ConstraintPipeline, buildHardConstraintPipeline } from "../constraints";
import type { ConstraintContext } from "../constraints/types";
import { ScheduleStream, type ScheduleStreamOptions } from "./scheduleStream";
import { courseSetKey, type CandidatePlan } from "../courseSelection/candidatePlan";

const cache = buildFixtureCache();

function plan(courses: string[]): CandidatePlan {
  return {
    courses,
    pinned: [],
    optionalPool: courses,
    chosenFromPool: {},
    courseSetKey: courseSetKey(courses),
    cache,
  };
}

function makeOptions(
  plans: CandidatePlan[],
  seed: number,
  overrides: Partial<ScheduleStreamOptions> = {},
): ScheduleStreamOptions {
  const baseCtx: ConstraintContext = {
    cache,
    completed: new Set<string>(),
    prereqEligible: new Set(ALL_FIXTURE_CODES),
  };
  return {
    makeRng: () => createSeededRng(seed),
    makePlanSource: () => plans[Symbol.iterator](),
    pipeline: new ConstraintPipeline(buildHardConstraintPipeline(DEFAULT_CONSTRAINTS, [])),
    baseCtx,
    ...overrides,
  };
}

function drainFingerprints(stream: ScheduleStream, cap = 500): string[] {
  const out: string[] = [];
  for (let i = 0; i < cap; i++) {
    const r = stream.next();
    if (!r) break;
    out.push(r.fingerprint);
  }
  return out;
}

const SET_A = ["CSI 2110", "MAT 1320", "PHI 1101", "HIS 1100"];
const SET_B = ["CSI 2120", "MAT 1322", "SEG 2105", "CSI 2101"];

describe("ScheduleStream", () => {
  it("yields multiple distinct conflict-free arrangements of one course set", () => {
    const stream = new ScheduleStream(makeOptions([plan(SET_A)], 42));
    const results = [];
    for (let i = 0; i < 100; i++) {
      const r = stream.next();
      if (!r) break;
      results.push(r);
    }

    // The legacy solver returned exactly ONE arrangement here.
    expect(results.length).toBeGreaterThan(1);

    // All distinct.
    const fps = results.map((r) => r.fingerprint);
    expect(new Set(fps).size).toBe(fps.length);

    // Every arrangement is internally conflict-free.
    for (const r of results) {
      const e = r.schedule.enrollments;
      for (let i = 0; i < e.length; i++) {
        for (let j = i + 1; j < e.length; j++) {
          expect(enrollmentsOverlap(e[i], e[j])).toBe(false);
        }
      }
      expect(e.map((x) => x.courseCode).sort()).toEqual([...SET_A].sort());
    }
  });

  it("is deterministic: same seed replays the identical ordered sequence", () => {
    const a = drainFingerprints(new ScheduleStream(makeOptions([plan(SET_A)], 7)));
    const b = drainFingerprints(new ScheduleStream(makeOptions([plan(SET_A)], 7)));
    expect(a).toEqual(b);
  });

  it("reset() replays the identical sequence", () => {
    const stream = new ScheduleStream(makeOptions([plan(SET_A)], 7));
    const first = drainFingerprints(stream);
    stream.reset();
    const second = drainFingerprints(stream);
    expect(second).toEqual(first);
  });

  it("explores the same arrangement SET regardless of seed (no premature exhaustion)", () => {
    const a = new Set(drainFingerprints(new ScheduleStream(makeOptions([plan(SET_A)], 1))));
    const b = new Set(drainFingerprints(new ScheduleStream(makeOptions([plan(SET_A)], 9999))));
    expect(a).toEqual(b);
    expect(a.size).toBeGreaterThan(1);
  });

  it("reports exhaustion only once the bounded search is truly drained", () => {
    const stream = new ScheduleStream(makeOptions([plan(SET_A)], 3));
    drainFingerprints(stream);
    expect(stream.exhausted).toBe(true);
    expect(stream.next()).toBeNull();
  });

  it("prioritises course-set diversity across the first results", () => {
    const stream = new ScheduleStream(makeOptions([plan(SET_A), plan(SET_B)], 5));
    const firstTwo = [stream.next(), stream.next()];
    const keys = firstTwo.map((r) => r?.plan.courseSetKey);
    // Both distinct course sets surface immediately, interleaved.
    expect(new Set(keys).size).toBe(2);
  });

  it("dedupes plans that resolve to the same course set", () => {
    const stream = new ScheduleStream(makeOptions([plan(SET_A), plan([...SET_A].reverse())], 5));
    const results = [];
    for (let i = 0; i < 200; i++) {
      const r = stream.next();
      if (!r) break;
      results.push(r);
    }
    // The duplicate set must not double the output.
    const single = new ScheduleStream(makeOptions([plan(SET_A)], 5));
    const singleCount = drainFingerprints(single).length;
    expect(results.length).toBe(singleCount);
  });

  it("at(ordinal) materialises lazily and matches sequential next()", () => {
    const seq = drainFingerprints(new ScheduleStream(makeOptions([plan(SET_A)], 11)));
    const stream = new ScheduleStream(makeOptions([plan(SET_A)], 11));
    expect(stream.at(2)?.fingerprint).toBe(seq[2]);
    expect(stream.at(0)?.fingerprint).toBe(seq[0]);
  });
});
