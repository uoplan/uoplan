// `collectAssignedFromExactRequirements` and `getDisciplineCodesForProgram` now
// live in @uoplan/core so the web store and the native planner share one copy.
// Re-exported here so existing `requirementCompute` barrel imports keep working.
export { collectAssignedFromExactRequirements, getDisciplineCodesForProgram } from "@uoplan/core";
