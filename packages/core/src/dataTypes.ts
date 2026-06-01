export * from "./dataTypes/domain";
export { fromProtoDistribution } from "./dataTypes/grades";
export type {
  CourseGradesData,
  CourseGradesEntry,
  CourseGradesProfessor,
} from "./dataTypes/grades";
export { fromProtoCourseGradesData } from "./dataTypes/grades";
export {
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoDisciplinesData,
  fromProtoIndices,
  fromProtoRateMyProfessorsData,
  fromProtoSchedulesData,
  fromProtoTermsData,
  toProtoCatalogue,
  toProtoCatalogueManifest,
  toProtoDisciplinesData,
  toProtoIndices,
  toProtoRateMyProfessorsData,
  toProtoSchedulesData,
  toProtoTermsData,
} from "./dataTypes/schedules";
