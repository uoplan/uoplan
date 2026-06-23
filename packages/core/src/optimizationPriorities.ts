//! Shared optimization-priorities model — the single source of truth for the
//! ordered, individually-toggleable schedule-generation objectives, consumed by
//! BOTH the web app (`packages/store`) and the native app (`apps/native`). The
//! Rust engine receives the same list via the `engine.proto`
//! `optimization_priorities` field (mapped in `engineBridge.ts`), so a generated
//! timetable is identical across platforms for the same options.
//!
//! Each priority is an *objective* the engine optimizes for. They are ranked
//! (higher in the list = higher priority) and individually `enabled` — a
//! disabled objective is removed from the optimization entirely (not merely
//! ranked low). `good_breaks` additionally carries `breakCount` /
//! `breakTargetMinutes` ("aim for N breaks of about M minutes").

/** Every optimization objective, in the default priority order. */
export const OPTIMIZATION_KINDS = [
  "free_days",
  "good_breaks",
  "prefer_easier",
  "prefer_sentiment",
  "prefer_professor_rating",
] as const;

export type OptimizationKind = (typeof OPTIMIZATION_KINDS)[number];

export interface OptimizationPriority {
  kind: OptimizationKind;
  /** When false the objective is excluded from generation entirely. */
  enabled: boolean;
  /** `good_breaks` only — desired number of breaks per day. */
  breakCount?: number;
  /** `good_breaks` only — target break length in minutes. */
  breakTargetMinutes?: number;
}

export const DEFAULT_GOOD_BREAKS_COUNT = 1;
export const DEFAULT_GOOD_BREAKS_TARGET_MINUTES = 90;
export const MIN_GOOD_BREAKS_COUNT = 0;
export const MAX_GOOD_BREAKS_COUNT = 4;
export const MIN_GOOD_BREAKS_TARGET_MINUTES = 15;
export const MAX_GOOD_BREAKS_TARGET_MINUTES = 240;

/**
 * The default priority list. Order is the default ranking; `enabled` preserves
 * the prior web behaviour (the soft selection biases are on by default, the
 * timetable-shape objectives are off). Native previously defaulted these off —
 * sharing this model makes both platforms consistent.
 */
export const DEFAULT_OPTIMIZATION_PRIORITIES: readonly OptimizationPriority[] = [
  { kind: "free_days", enabled: false },
  {
    kind: "good_breaks",
    enabled: false,
    breakCount: DEFAULT_GOOD_BREAKS_COUNT,
    breakTargetMinutes: DEFAULT_GOOD_BREAKS_TARGET_MINUTES,
  },
  { kind: "prefer_easier", enabled: true },
  { kind: "prefer_sentiment", enabled: true },
  { kind: "prefer_professor_rating", enabled: true },
];

const KIND_SET: ReadonlySet<string> = new Set(OPTIMIZATION_KINDS);

export function isOptimizationKind(value?: unknown): value is OptimizationKind {
  return typeof value === "string" && KIND_SET.has(value);
}

/** Whether a `kind` carries the `good_breaks` break-count/length parameters. */
export function hasBreakParams(kind: OptimizationKind): boolean {
  return kind === "good_breaks";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function defaultFor(kind: OptimizationKind): OptimizationPriority {
  const found = DEFAULT_OPTIMIZATION_PRIORITIES.find((p) => p.kind === kind);
  return found ? { ...found } : { kind, enabled: false };
}

/** A fresh, deeply-cloned copy of the default priority list. */
export function defaultOptimizationPriorities(): OptimizationPriority[] {
  return DEFAULT_OPTIMIZATION_PRIORITIES.map((p) => ({ ...p }));
}

export function cloneOptimizationPriorities(
  list: readonly OptimizationPriority[],
): OptimizationPriority[] {
  return list.map((p) => ({ ...p }));
}

/** Normalize one (possibly partial / untrusted) entry, clamping break params. */
function normalizeEntry(
  kind: OptimizationKind,
  raw: Partial<OptimizationPriority>,
): OptimizationPriority {
  const base = defaultFor(kind);
  const entry: OptimizationPriority = {
    kind,
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : base.enabled,
  };
  if (hasBreakParams(kind)) {
    const count =
      typeof raw.breakCount === "number" && Number.isFinite(raw.breakCount)
        ? Math.round(raw.breakCount)
        : (base.breakCount ?? DEFAULT_GOOD_BREAKS_COUNT);
    const minutes =
      typeof raw.breakTargetMinutes === "number" && Number.isFinite(raw.breakTargetMinutes)
        ? Math.round(raw.breakTargetMinutes)
        : (base.breakTargetMinutes ?? DEFAULT_GOOD_BREAKS_TARGET_MINUTES);
    entry.breakCount = clamp(count, MIN_GOOD_BREAKS_COUNT, MAX_GOOD_BREAKS_COUNT);
    entry.breakTargetMinutes = clamp(
      minutes,
      MIN_GOOD_BREAKS_TARGET_MINUTES,
      MAX_GOOD_BREAKS_TARGET_MINUTES,
    );
  }
  return entry;
}

/**
 * Coerce any untrusted input (persisted JSON, decoded proto/URL state, partial
 * lists) into a complete, valid, ordered priority list: every {@link
 * OptimizationKind} appears exactly once, in the given order, with any missing
 * kinds appended in default order. Unknown/duplicate kinds are dropped.
 */
export function normalizeOptimizationPriorities(raw?: unknown): OptimizationPriority[] {
  const out: OptimizationPriority[] = [];
  const seen = new Set<OptimizationKind>();
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item !== "object" || item === null) continue;
      const candidate = item as Partial<OptimizationPriority>;
      if (!isOptimizationKind(candidate.kind) || seen.has(candidate.kind)) continue;
      seen.add(candidate.kind);
      out.push(normalizeEntry(candidate.kind, candidate));
    }
  }
  for (const kind of OPTIMIZATION_KINDS) {
    if (!seen.has(kind)) out.push(defaultFor(kind));
  }
  return out;
}

/** Move the priority at `fromIndex` to `toIndex` (returns a new list). */
export function reorderOptimizationPriorities(
  list: readonly OptimizationPriority[],
  fromIndex: number,
  toIndex: number,
): OptimizationPriority[] {
  const next = cloneOptimizationPriorities(list);
  if (
    fromIndex < 0 ||
    fromIndex >= next.length ||
    toIndex < 0 ||
    toIndex >= next.length ||
    fromIndex === toIndex
  ) {
    return next;
  }
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved!);
  return next;
}

/** Set a single objective's `enabled` flag (returns a new list). */
export function setOptimizationPriorityEnabled(
  list: readonly OptimizationPriority[],
  kind: OptimizationKind,
  enabled: boolean,
): OptimizationPriority[] {
  return list.map((p) => (p.kind === kind ? { ...p, enabled } : { ...p }));
}

/** Flip a single objective's `enabled` flag (returns a new list). */
export function toggleOptimizationPriority(
  list: readonly OptimizationPriority[],
  kind: OptimizationKind,
): OptimizationPriority[] {
  return list.map((p) => (p.kind === kind ? { ...p, enabled: !p.enabled } : { ...p }));
}

/** Update the `good_breaks` break-count / target-length params (returns a new list). */
export function setGoodBreaksParams(
  list: readonly OptimizationPriority[],
  params: { breakCount?: number; breakTargetMinutes?: number },
): OptimizationPriority[] {
  return list.map((p) => {
    if (p.kind !== "good_breaks") return { ...p };
    const next: OptimizationPriority = { ...p };
    if (params.breakCount != null && Number.isFinite(params.breakCount)) {
      next.breakCount = clamp(
        Math.round(params.breakCount),
        MIN_GOOD_BREAKS_COUNT,
        MAX_GOOD_BREAKS_COUNT,
      );
    }
    if (params.breakTargetMinutes != null && Number.isFinite(params.breakTargetMinutes)) {
      next.breakTargetMinutes = clamp(
        Math.round(params.breakTargetMinutes),
        MIN_GOOD_BREAKS_TARGET_MINUTES,
        MAX_GOOD_BREAKS_TARGET_MINUTES,
      );
    }
    return next;
  });
}

/** Look up one objective by kind. */
export function getOptimizationPriority(
  list: readonly OptimizationPriority[],
  kind: OptimizationKind,
): OptimizationPriority | undefined {
  return list.find((p) => p.kind === kind);
}

/** Whether a given objective is present and enabled. */
export function isOptimizationEnabled(
  list: readonly OptimizationPriority[],
  kind: OptimizationKind,
): boolean {
  return getOptimizationPriority(list, kind)?.enabled ?? false;
}
