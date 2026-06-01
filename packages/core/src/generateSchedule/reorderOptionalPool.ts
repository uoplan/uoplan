import type { CourseDifficultyIndex, DataCache, FrenchImmersionProgressOptions } from "../index";
import {
  analyzeFrenchImmersionProgress,
  frenchImmersionHeuristicPickWeight,
  normalizeCourseCode,
  shuffleInPlace,
  weightedRandomPick,
} from "../index";
import { EASIER_APLUS_BASE, EASIER_APLUS_PIVOT, EASIER_APLUS_SCALE } from "./helpers";

export function reorderOptionalPoolForGeneration(
  codes: string[],
  cache: DataCache,
  rng: () => number,
  options: {
    preferEasier: boolean;
    frenchImmersionStream: boolean;
    immersionOpts?: FrenchImmersionProgressOptions;
    immersionProgressBaseCodes: readonly string[];
    courseDifficultyIndex?: CourseDifficultyIndex;
  },
): void {
  const {
    preferEasier,
    frenchImmersionStream,
    immersionOpts,
    immersionProgressBaseCodes,
    courseDifficultyIndex,
  } = options;

  if (codes.length <= 1) return;

  if (!preferEasier && !frenchImmersionStream) {
    shuffleInPlace(codes, rng);
    return;
  }

  const easierMemo = new Map<string, number>();
  function easierWeight(code: string): number {
    if (!preferEasier) return 1;
    let w = easierMemo.get(code);
    if (w !== undefined) return w;
    const aPlus = courseDifficultyIndex ? courseDifficultyIndex(code) : null;
    w =
      aPlus == null
        ? 1
        : Math.pow(EASIER_APLUS_BASE, (aPlus - EASIER_APLUS_PIVOT) / EASIER_APLUS_SCALE);
    easierMemo.set(code, w);
    return w;
  }

  const progSnapshot =
    frenchImmersionStream && immersionOpts != null
      ? analyzeFrenchImmersionProgress(
          [...new Set(immersionProgressBaseCodes.map((c) => normalizeCourseCode(c)))],
          cache,
          immersionOpts,
        )
      : null;

  const remaining = [...codes];
  codes.length = 0;
  while (remaining.length > 0) {
    const weights = remaining.map((code) => {
      let w = easierWeight(code);
      if (progSnapshot) {
        w *= frenchImmersionHeuristicPickWeight(progSnapshot, code, cache);
      }
      return w;
    });
    const picked = weightedRandomPick(remaining, weights, rng);
    codes.push(picked);
    const idx = remaining.indexOf(picked);
    remaining.splice(idx, 1);
  }
}
