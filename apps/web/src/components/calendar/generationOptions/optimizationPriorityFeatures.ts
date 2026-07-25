import type { OptimizationKind } from "@uoplan/core";
import type { SchoolFeatures } from "@uoplan/domain/school";

/**
 * The school capability each ranking goal scores against. Goals whose data the
 * school doesn't publish are hidden rather than shown as no-ops — ranking by an
 * empty dataset silently does nothing, which reads as a broken control.
 *
 * Hidden goals stay in the stored priority list so switching schools (or a
 * school later gaining the data) restores the user's ordering untouched.
 */
const PRIORITY_REQUIRED_FEATURE: Partial<Record<OptimizationKind, keyof SchoolFeatures>> = {
  prefer_easier: "grades",
  prefer_sentiment: "feedback",
};

/** Whether a ranking goal is backed by data at the given school. */
export function optimizationPrioritySupported(
  kind: OptimizationKind,
  features: SchoolFeatures,
): boolean {
  const required = PRIORITY_REQUIRED_FEATURE[kind];
  return required === undefined || features[required];
}
