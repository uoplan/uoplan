import {
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoCourseGradesData,
  fromProtoDisciplinesData,
  fromProtoIndices,
  fromProtoRateMyProfessorsData,
  fromProtoSchedulesData,
  fromProtoTermsData,
} from "@uoplan/core/dataTypes";
import type {
  Catalogue,
  CatalogueManifest,
  CourseGradesData,
  DisciplinesData,
  Indices,
  SchedulesData,
  TermsData,
} from "@uoplan/core/dataTypes";
import { buildProfessorRatingsMap } from "@uoplan/core/professorRatings";
import type { ProfessorRatingsMap } from "@uoplan/core/professorRatings";
import { fromProtoProfessorsData } from "@uoplan/core/professorRegistry";
import type { ProfessorRegistryEntry } from "@uoplan/core/professorRegistry";
import {
  Catalogue as ProtoCatalogue,
  CatalogueManifest as ProtoCatalogueManifest,
  DisciplinesData as ProtoDisciplinesData,
  GradesData as ProtoGradesData,
  Indices as ProtoIndices,
  ProfessorsData as ProtoProfessorsData,
  RateMyProfessorsData as ProtoRateMyProfessorsData,
  SchedulesData as ProtoSchedulesData,
  TermsData as ProtoTermsData,
} from "@uoplan/proto/data";
import { FeedbackData as ProtoFeedbackData } from "@uoplan/proto/feedback";

/**
 * Decode `.pb` bytes into runtime domain objects. These mirror the
 * `@uoplan/data` loaders but import the proto codecs + core converters through
 * barrel-safe subpaths so Metro never pulls the Node-only `ical-generator` the
 * `@uoplan/core` barrel re-exports into the native bundle.
 */
export function decodeTerms(bytes: Uint8Array): TermsData {
  return fromProtoTermsData(ProtoTermsData.decode(bytes));
}

export function decodeDisciplines(bytes: Uint8Array): DisciplinesData {
  return fromProtoDisciplinesData(ProtoDisciplinesData.decode(bytes));
}

export function decodeGrades(bytes: Uint8Array): CourseGradesData {
  return fromProtoCourseGradesData(ProtoGradesData.decode(bytes));
}

export function decodeIndices(bytes: Uint8Array): Indices {
  return fromProtoIndices(ProtoIndices.decode(bytes));
}

export function decodeCatalogueManifest(bytes: Uint8Array): CatalogueManifest {
  return fromProtoCatalogueManifest(ProtoCatalogueManifest.decode(bytes));
}

export function decodeCatalogue(bytes: Uint8Array): Catalogue {
  return fromProtoCatalogue(ProtoCatalogue.decode(bytes));
}

export function decodeSchedules(bytes: Uint8Array): SchedulesData {
  return fromProtoSchedulesData(ProtoSchedulesData.decode(bytes));
}

export function decodeProfessors(bytes: Uint8Array): ProfessorRegistryEntry[] {
  return fromProtoProfessorsData(ProtoProfessorsData.decode(bytes));
}

export function decodeProfessorRatings(bytes: Uint8Array): ProfessorRatingsMap {
  return buildProfessorRatingsMap(
    fromProtoRateMyProfessorsData(ProtoRateMyProfessorsData.decode(bytes)),
  );
}

/** The ordered course-code list reconstructed from `indices.pb` (the index space
 *  the feedback dataset references its courses against). */
export function decodeIndicesCourses(bytes: Uint8Array): string[] {
  return fromProtoIndices(ProtoIndices.decode(bytes)).courses;
}

/** The decoded `feedback.pb` message. Turned into a lookup index with
 *  `buildFeedbackIndex(data, indicesCourses)` from `@uoplan/core/feedback`. */
export function decodeFeedbackData(bytes: Uint8Array): ReturnType<typeof ProtoFeedbackData.decode> {
  return ProtoFeedbackData.decode(bytes);
}
