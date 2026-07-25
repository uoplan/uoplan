export * from "./brand";
export * from "./facultyIdentity";
export * from "./generation";
export * from "./generationDiagnostics";
export * from "./optimizationPriorities";
export * from "./compareSelection";
export * from "./dataTypes";
export * from "./school";
export * from "./scheduleFilters";
export * from "./courseFilters";
export * from "./professorIdentity";
export * from "./professorRegistry";
export * from "./professorRatings";
export * from "./professorCoTeachingGraph";
export * from "./professorDisciplineColors";
export * from "./gradeDistribution";
export * from "./gradeTrends";
export * from "./gradeAnalytics";
export * from "./programTrends";
export * from "./gradeLookup";
export * from "./instructorPrediction";
export * from "./instructorPredictionExplain";
export * from "./seededRandom";
export * from "./dataCache";
export * from "./utils/courseUtils";
export * from "./utils/timeUtils";
export * from "./utils/uiUtils";
export * from "./utils/groupToken";
export * from "./ics";
export * from "./frenchImmersionDiploma";
export * from "./stateEncode";
export * from "./termDefaults";
/** @deprecated Prefer `@uoplan/search` — re-exported for compatibility. */
export {
  DescriptionSearchIndex,
  buildDescriptionSearchIndexFixture,
  encodeTermDictionary,
  tokenizeDescription,
} from "@uoplan/search";
export type { DescriptionMatch, DescriptionSearchFixtureCourse } from "@uoplan/search";
export * from "./prerequisites";
export * from "./requirements";
export * as DataProto from "@uoplan/proto/data";
export * from "./poolHelpers";
export * from "./implicitHonours";
export * from "./requirementExpansion";
export * from "./engineBridge";
export { arrangementFingerprint } from "@uoplan/generation/generation/fingerprint";
export * from "./scheduleFromStateEngine";
export * from "./schedulePreview";
export * from "./feedback";
export * as FeedbackProto from "@uoplan/proto/feedback";
