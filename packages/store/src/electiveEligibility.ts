// Elective-eligibility predicates (isElectiveRequirementType,
// isWithinElectiveLevelCap, virtualScheduleFilterApplies) live in @uoplan/core
// (poolHelpers). They are re-exported here alongside the web-only "basic mode"
// default buckets so existing app imports keep a single entry point.
export {
  isElectiveRequirementType,
  isWithinElectiveLevelCap,
  virtualScheduleFilterApplies,
} from "@uoplan/core";

export const DEFAULT_BASIC_ELECTIVE_LEVEL_BUCKETS = [1000, 2000];
export const DEFAULT_BASIC_LEVEL_BUCKETS = ["undergrad"] as const;
export const DEFAULT_BASIC_LANGUAGE_BUCKETS = ["en", "other"] as const;
