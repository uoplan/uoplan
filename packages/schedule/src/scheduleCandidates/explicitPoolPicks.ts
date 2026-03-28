import {
  computeKUserKGeneral,
  shouldPinAllExplicit,
  shouldUseExplicitOnlyPool,
} from "./kUserKGeneral";
import type { GlobalExplicitRule } from "./types";

/**
 * Per-requirement split: kUser from constrained picks, kGeneral from the general pool.
 * Same as min(need, constrainedAvailableCount) with remainder for general.
 */
export function splitRequiredAndGeneral(
  need: number,
  constrainedAvailableCount: number,
): { kUser: number; kGeneral: number } {
  return computeKUserKGeneral(need, constrainedAvailableCount);
}

/**
 * Global rule: enough explicit picks to fill the term vs must-pin all explicit.
 */
export function mergeGlobalExplicitRule(
  explicitUnionSize: number,
  effectiveTargetNonHonours: number,
): GlobalExplicitRule {
  return {
    pinAllExplicit: shouldPinAllExplicit(
      explicitUnionSize,
      effectiveTargetNonHonours,
    ),
    explicitOnly: shouldUseExplicitOnlyPool(
      explicitUnionSize,
      effectiveTargetNonHonours,
    ),
  };
}

export type PickFromPoolsResult = {
  userPicks: string[];
  generalPicks: string[];
  /** False if there are not enough general candidates for kGeneral. */
  ok: boolean;
};

/**
 * After caller shuffles `sAvailOrdered` and `gAvailOrdered`, takes the first
 * kUser / kGeneral codes respectively (general pool excludes user picks).
 */
export function pickFromUserAndGeneralPools(input: {
  need: number;
  sAvailOrdered: string[];
  gAvailOrdered: string[];
}): PickFromPoolsResult {
  const { kUser, kGeneral } = splitRequiredAndGeneral(
    input.need,
    input.sAvailOrdered.length,
  );
  const userPicks = input.sAvailOrdered.slice(0, kUser);
  const generalPicks = input.gAvailOrdered.slice(0, kGeneral);
  const ok = generalPicks.length === kGeneral;
  return { userPicks, generalPicks, ok };
}
