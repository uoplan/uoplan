import {
  type Catalogue,
  type CourseGradesData,
  type DisciplinesData,
  type Indices,
  type ProfessorRatingsMap,
  type RateMyProfessorsData,
  type SchedulesData,
  type TermsData,
  DataProto,
  FeedbackProto,
  buildProfessorRatingsMap,
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoCourseGradesData,
  fromProtoDisciplinesData,
  fromProtoIndices,
  fromProtoRateMyProfessorsData,
  fromProtoSchedulesData,
  fromProtoTermsData,
} from "@uoplan/core";
import type { FetchBytes } from "./transport";

/** Canonical asset ids (bare `.pb` filenames) for every data asset. */
export const dataAssetIds = {
  manifest: "catalogue.pb",
  catalogue: (year: number): string => `catalogue.${year}.pb`,
  schedules: (termId: string): string => `schedules.${termId}.pb`,
  terms: "terms.pb",
  indices: "indices.pb",
  rateMyProfessors: "ratemyprofessors.pb",
  grades: "grades.pb",
  disciplines: "disciplines.pb",
  feedback: "feedback.pb",
} as const;

export interface CatalogueManifest {
  years: number[];
}

export async function loadCatalogueManifest(fetchBytes: FetchBytes): Promise<CatalogueManifest> {
  return fromProtoCatalogueManifest(
    DataProto.CatalogueManifest.decode(await fetchBytes(dataAssetIds.manifest)),
  );
}

export async function loadCatalogue(fetchBytes: FetchBytes, year: number): Promise<Catalogue> {
  return fromProtoCatalogue(
    DataProto.Catalogue.decode(await fetchBytes(dataAssetIds.catalogue(year))),
  );
}

export async function loadSchedules(
  fetchBytes: FetchBytes,
  termId: string,
): Promise<SchedulesData> {
  return fromProtoSchedulesData(
    DataProto.SchedulesData.decode(await fetchBytes(dataAssetIds.schedules(termId))),
  );
}

export async function loadTerms(fetchBytes: FetchBytes): Promise<TermsData> {
  return fromProtoTermsData(DataProto.TermsData.decode(await fetchBytes(dataAssetIds.terms)));
}

export async function loadIndices(fetchBytes: FetchBytes): Promise<Indices> {
  return fromProtoIndices(DataProto.Indices.decode(await fetchBytes(dataAssetIds.indices)));
}

export async function loadRateMyProfessors(fetchBytes: FetchBytes): Promise<RateMyProfessorsData> {
  return fromProtoRateMyProfessorsData(
    DataProto.RateMyProfessorsData.decode(await fetchBytes(dataAssetIds.rateMyProfessors)),
  );
}

export async function loadProfessorRatings(fetchBytes: FetchBytes): Promise<ProfessorRatingsMap> {
  return buildProfessorRatingsMap(await loadRateMyProfessors(fetchBytes));
}

export async function loadGrades(fetchBytes: FetchBytes): Promise<CourseGradesData> {
  return fromProtoCourseGradesData(
    DataProto.GradesData.decode(await fetchBytes(dataAssetIds.grades)),
  );
}

export async function loadDisciplines(fetchBytes: FetchBytes): Promise<DisciplinesData> {
  return fromProtoDisciplinesData(
    DataProto.DisciplinesData.decode(await fetchBytes(dataAssetIds.disciplines)),
  );
}

/** Decode the combined course-evaluation dataset. Build a lookup with
 * `buildFeedbackIndex` (it needs the shared `indices.pb` course list). */
export async function loadFeedback(fetchBytes: FetchBytes): Promise<FeedbackProto.FeedbackData> {
  return FeedbackProto.FeedbackData.decode(await fetchBytes(dataAssetIds.feedback));
}
