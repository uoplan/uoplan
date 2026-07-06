import {
  buildProfessorRatingsMap,
  DataProto,
  DescriptionSearchIndex,
  FeedbackProto,
  fromProtoCatalogue,
  fromProtoCatalogueManifest,
  fromProtoCourseGradesData,
  fromProtoDisciplinesData,
  fromProtoIndices,
  fromProtoProfessorsData,
  fromProtoRateMyProfessorsData,
  fromProtoSchedulesData,
  fromProtoTermsData,
} from "@uoplan/core";
import type {
  Catalogue,
  CourseGradesData,
  DisciplinesData,
  Indices,
  ProfessorRatingsMap,
  ProfessorRegistryEntry,
  RateMyProfessorsData,
  SchedulesData,
  TermsData,
} from "@uoplan/core";
import type { FetchBytes } from "./transport";

/** Canonical asset ids (bare `.pb` filenames) for every data asset. */
export const dataAssetIds = {
  manifest: "catalogue.pb",
  catalogueUnion: "catalogue.union.pb",
  catalogueSearch: "catalogue.search.pb",
  cataloguePrereqHistory: "catalogue.history.pb",
  catalogueProgramHistory: "catalogue.programs.history.pb",
  schedules: (termId: string): string => `schedules.${termId}.pb`,
  terms: "terms.pb",
  indices: "indices.pb",
  rateMyProfessors: "ratemyprofessors.pb",
  grades: "grades.pb",
  disciplines: "disciplines.pb",
  feedback: "feedback.pb",
  professors: "professors.pb",
} as const;

export interface CatalogueManifest {
  years: number[];
}

export async function loadCatalogueManifest(fetchBytes: FetchBytes): Promise<CatalogueManifest> {
  return fromProtoCatalogueManifest(
    DataProto.CatalogueManifest.decode(await fetchBytes(dataAssetIds.manifest)),
  );
}

/** Decode the raw union catalogue proto (all courses, latest metadata). Kept as
 * a proto so {@link reconstructCatalogueForYear} can index into `course_codes`. */
export async function loadCatalogueUnionProto(
  fetchBytes: FetchBytes,
): Promise<DataProto.Catalogue> {
  return DataProto.Catalogue.decode(await fetchBytes(dataAssetIds.catalogueUnion));
}

/** Decode the union catalogue into runtime types. */
export async function loadCatalogueUnion(fetchBytes: FetchBytes): Promise<Catalogue> {
  return fromProtoCatalogue(await loadCatalogueUnionProto(fetchBytes));
}

/** Decode the per-course prerequisite-history overlay (kept as a proto; paired
 * with the union proto by {@link reconstructCatalogueForYear}). */
export async function loadCataloguePrereqHistory(
  fetchBytes: FetchBytes,
): Promise<DataProto.CataloguePrereqHistory> {
  return DataProto.CataloguePrereqHistory.decode(
    await fetchBytes(dataAssetIds.cataloguePrereqHistory),
  );
}

/** Decode the compact course-description keyword index for explore search. */
export async function loadCourseSearchIndex(
  fetchBytes: FetchBytes,
): Promise<DescriptionSearchIndex> {
  return DescriptionSearchIndex.fromProto(
    DataProto.CourseSearchIndex.decode(await fetchBytes(dataAssetIds.catalogueSearch)),
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

export async function loadProfessors(fetchBytes: FetchBytes): Promise<ProfessorRegistryEntry[]> {
  return fromProtoProfessorsData(
    DataProto.ProfessorsData.decode(await fetchBytes(dataAssetIds.professors)),
  );
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
