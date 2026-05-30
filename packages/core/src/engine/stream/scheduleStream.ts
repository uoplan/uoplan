/**
 * Layer 3 — ScheduleStream.
 *
 * Composes a lazy source of {@link CandidatePlan}s (course selection) with the
 * lazy {@link enumerateArrangements timetable enumerator} (section/time choice)
 * into a single deterministic, deduplicated sequence of distinct full
 * timetables, navigable by ordinal.
 *
 * Design goals (each fixes a concrete legacy bug):
 *   - **Genuine variety** — a *fair frontier* keeps up to `frontierWidth`
 *     distinct course sets active at once and round-robins one fresh arrangement
 *     from each, so early results are spread across many course sets *and* many
 *     section/time arrangements (legacy returned the first arrangement only).
 *   - **No premature exhaustion** — dedup is by full timetable fingerprint
 *     (courses + chosen sections), so the large space of arrangements is
 *     actually traversed instead of collapsing to one per course set.
 *   - **Determinism / shareable cursors** — the whole stream is a pure function
 *     of the seed: the same seed replays the identical ordered sequence, so an
 *     `ordinal` is a stable cursor. {@link ScheduleStream.reset} rebuilds the
 *     sequence from scratch for replay.
 *
 * The stream is deliberately a *bounded fair search*, not a globally exhaustive
 * one: it reports exhaustion only when its frontier and plan source are both
 * drained (or the no-progress budget trips), which is the honest signal that no
 * further distinct timetable is reachable within the search.
 */
import type { GeneratedSchedule } from "../../generation";
import type { ConstraintContext } from "../constraints/types";
import type { ConstraintPipeline } from "../constraints/pipeline";
import { buildTimetableCourse, type TimetableCourse } from "../timetable/lazyCombos";
import { enumerateArrangements, arrangementFingerprint } from "../timetable/enumerator";
import type { CandidatePlan } from "../courseSelection/candidatePlan";

interface StreamSchedule {
  readonly schedule: GeneratedSchedule;
  readonly plan: CandidatePlan;
  /** Full timetable fingerprint (courses + sections). */
  readonly fingerprint: string;
  /** 0-based position in the deterministic sequence — the navigable cursor. */
  readonly ordinal: number;
}

export interface ScheduleStreamOptions {
  /** Fresh seeded RNG; shared by the plan source and combo shuffling. */
  readonly makeRng: () => () => number;
  /** Builds the lazy plan source from the shared RNG. */
  readonly makePlanSource: (rng: () => number) => Iterator<CandidatePlan>;
  readonly pipeline: ConstraintPipeline;
  /** Base context; `cache` is overridden per plan. */
  readonly baseCtx: ConstraintContext;
  /** Distinct course sets kept active simultaneously (variety vs. latency). */
  readonly frontierWidth?: number;
  /** Safety budget: consecutive no-yield cycles before declaring exhaustion. */
  readonly maxEmptyPolls?: number;
}

const DEFAULT_FRONTIER_WIDTH = 24;
const DEFAULT_MAX_EMPTY_POLLS = 8192;

interface FrontierEntry {
  readonly key: string;
  readonly plan: CandidatePlan;
  readonly arrangements: Generator<GeneratedSchedule>;
}

export class ScheduleStream {
  private readonly opts: ScheduleStreamOptions;
  private produced: StreamSchedule[] = [];
  private gen: Generator<StreamSchedule>;
  private done = false;

  constructor(opts: ScheduleStreamOptions) {
    this.opts = opts;
    this.gen = this.produce();
  }

  /** Discard all produced results and rebuild the sequence from the seed. */
  reset(): void {
    this.produced = [];
    this.done = false;
    this.gen = this.produce();
  }

  /** Produce and cache the next distinct timetable, or null if exhausted. */
  next(): StreamSchedule | null {
    if (this.done) return null;
    const r = this.gen.next();
    if (r.done) {
      this.done = true;
      return null;
    }
    this.produced.push(r.value);
    return r.value;
  }

  /** Result at `ordinal`, producing more as needed; null if beyond the end. */
  at(ordinal: number): StreamSchedule | null {
    if (ordinal < 0) return null;
    while (this.produced.length <= ordinal && !this.done) this.next();
    return this.produced[ordinal] ?? null;
  }

  /** Results produced so far (no further production). */
  get materialised(): readonly StreamSchedule[] {
    return this.produced;
  }

  /** True once the bounded search has been fully drained. */
  get exhausted(): boolean {
    return this.done;
  }

  private planContext(plan: CandidatePlan): ConstraintContext {
    return { ...this.opts.baseCtx, cache: plan.cache };
  }

  /** Build every required course's seeded combos; null if any is unschedulable. */
  private buildPlanCourses(plan: CandidatePlan, rng: () => number): TimetableCourse[] | null {
    const ctx = this.planContext(plan);
    const out: TimetableCourse[] = [];
    for (const code of plan.courses) {
      const tc = buildTimetableCourse(code, plan.cache, this.opts.pipeline, ctx, rng);
      if (!tc) return null;
      out.push(tc);
    }
    return out;
  }

  private *produce(): Generator<StreamSchedule> {
    const width = this.opts.frontierWidth ?? DEFAULT_FRONTIER_WIDTH;
    const maxEmpty = this.opts.maxEmptyPolls ?? DEFAULT_MAX_EMPTY_POLLS;
    const rng = this.opts.makeRng();
    const planSource = this.opts.makePlanSource(rng);

    const frontier: FrontierEntry[] = [];
    const activeKeys = new Set<string>();
    const seenFingerprints = new Set<string>();
    let sourceDone = false;
    let ordinal = 0;
    let rotate = 0;
    let emptyPolls = 0;

    const refill = (): void => {
      while (!sourceDone && frontier.length < width) {
        const r = planSource.next();
        if (r.done) {
          sourceDone = true;
          break;
        }
        const plan = r.value;
        if (activeKeys.has(plan.courseSetKey)) continue;
        const courses = this.buildPlanCourses(plan, rng);
        if (!courses) continue; // course set has no usable arrangement at all
        activeKeys.add(plan.courseSetKey);
        frontier.push({
          key: plan.courseSetKey,
          plan,
          arrangements: enumerateArrangements(courses, this.opts.pipeline, this.planContext(plan)),
        });
      }
    };

    while (true) {
      refill();
      if (frontier.length === 0) return;

      let yielded = false;
      let madeProgress = false;

      for (let scanned = 0; scanned < frontier.length; scanned++) {
        const idx = (rotate + scanned) % frontier.length;
        const entry = frontier[idx];
        const nx = entry.arrangements.next();

        if (nx.done) {
          frontier.splice(idx, 1);
          madeProgress = true;
          rotate = frontier.length === 0 ? 0 : idx % frontier.length;
          scanned -= 1; // indices shifted; re-scan from same slot
          if (frontier.length === 0) break;
          continue;
        }

        madeProgress = true;
        rotate = idx + 1;
        const fp = arrangementFingerprint(nx.value);
        if (seenFingerprints.has(fp)) continue; // same timetable via another path
        seenFingerprints.add(fp);
        yield { schedule: nx.value, plan: entry.plan, fingerprint: fp, ordinal: ordinal++ };
        yielded = true;
        break;
      }

      if (yielded) {
        emptyPolls = 0;
      } else if (!madeProgress) {
        if (++emptyPolls > maxEmpty) return;
      }

      if (frontier.length === 0 && sourceDone) return;
    }
  }
}
