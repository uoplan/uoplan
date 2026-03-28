/**
 * Unified rule: kUser = min(need, constrainedCount), kGeneral = need - kUser.
 * Equivalently kGeneral = max(0, need - constrainedCount).
 */
export function computeKUserKGeneral(
  need: number,
  constrainedCount: number,
): { kUser: number; kGeneral: number } {
  const n = Math.max(0, need);
  const c = Math.max(0, constrainedCount);
  const kUser = Math.min(n, c);
  const kGeneral = n - kUser;
  return { kUser, kGeneral };
}

/** When |E| >= effectiveTarget (non-honours slots), only courses from E may appear. */
export function shouldUseExplicitOnlyPool(
  explicitUnionSize: number,
  effectiveTargetNonHonours: number,
): boolean {
  return explicitUnionSize >= effectiveTargetNonHonours && effectiveTargetNonHonours > 0;
}

/** When |E| < effectiveTarget, every course in E must appear in the schedule. */
export function shouldPinAllExplicit(
  explicitUnionSize: number,
  effectiveTargetNonHonours: number,
): boolean {
  return (
    explicitUnionSize > 0 &&
    explicitUnionSize < effectiveTargetNonHonours
  );
}
