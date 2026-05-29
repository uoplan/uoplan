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

/** Canonical public paths for every `.pb` asset served from `/data`. */
export const dataPaths = {
  manifest: "/data/catalogue.pb",
  catalogue: (year: number): string => `/data/catalogue.${year}.pb`,
  schedules: (termId: string): string => `/data/schedules.${termId}.pb`,
  terms: "/data/terms.pb",
  indices: "/data/indices.pb",
  rateMyProfessors: "/data/ratemyprofessors.pb",
  grades: "/data/grades.pb",
  disciplines: "/data/disciplines.pb",
} as const;

export interface CatalogueManifest {
  years: number[];
}

export async function loadCatalogueManifest(fetchBytes: FetchBytes): Promise<CatalogueManifest> {
  return fromProtoCatalogueManifest(
    DataProto.CatalogueManifest.decode(await fetchBytes(dataPaths.manifest)),
  );
}

export async function loadCatalogue(fetchBytes: FetchBytes, year: number): Promise<Catalogue> {
  return fromProtoCatalogue(
    DataProto.Catalogue.decode(await fetchBytes(dataPaths.catalogue(year))),
  );
}

export async function loadSchedules(
  fetchBytes: FetchBytes,
  termId: string,
): Promise<SchedulesData> {
  return fromProtoSchedulesData(
    DataProto.SchedulesData.decode(await fetchBytes(dataPaths.schedules(termId))),
  );
}

export async function loadTerms(fetchBytes: FetchBytes): Promise<TermsData> {
  return fromProtoTermsData(DataProto.TermsData.decode(await fetchBytes(dataPaths.terms)));
}

export async function loadIndices(fetchBytes: FetchBytes): Promise<Indices> {
  return fromProtoIndices(DataProto.Indices.decode(await fetchBytes(dataPaths.indices)));
}

export async function loadRateMyProfessors(fetchBytes: FetchBytes): Promise<RateMyProfessorsData> {
  return fromProtoRateMyProfessorsData(
    DataProto.RateMyProfessorsData.decode(await fetchBytes(dataPaths.rateMyProfessors)),
  );
}

export async function loadProfessorRatings(fetchBytes: FetchBytes): Promise<ProfessorRatingsMap> {
  return buildProfessorRatingsMap(await loadRateMyProfessors(fetchBytes));
}

export async function loadGrades(fetchBytes: FetchBytes): Promise<CourseGradesData> {
  return fromProtoCourseGradesData(DataProto.GradesData.decode(await fetchBytes(dataPaths.grades)));
}

export async function loadDisciplines(fetchBytes: FetchBytes): Promise<DisciplinesData> {
  return fromProtoDisciplinesData(
    DataProto.DisciplinesData.decode(await fetchBytes(dataPaths.disciplines)),
  );
}
