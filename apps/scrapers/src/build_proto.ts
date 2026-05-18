/* eslint-disable */
import fs from "node:fs/promises";
import path from "node:path";
import * as DataProto from "../../../packages/schedule/src/proto/data.ts";
import { SCRAPER_DATA_DIR, WEB_PUBLIC_DATA_DIR } from "./dataPaths.ts";

type JsonObject = Record<string, unknown>;

function parseTermIdToNumber(termId: string): number {
  const parsed = Number.parseInt(termId, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateStringToYyyymmdd(value: string): number {
  const compact = value.replaceAll("-", "");
  const parsed = Number.parseInt(compact, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dayToProto(day: string): number {
  switch (day) {
    case "Mo":
      return DataProto.DayOfWeek.DAY_OF_WEEK_MO;
    case "Tu":
      return DataProto.DayOfWeek.DAY_OF_WEEK_TU;
    case "We":
      return DataProto.DayOfWeek.DAY_OF_WEEK_WE;
    case "Th":
      return DataProto.DayOfWeek.DAY_OF_WEEK_TH;
    case "Fr":
      return DataProto.DayOfWeek.DAY_OF_WEEK_FR;
    case "Sa":
      return DataProto.DayOfWeek.DAY_OF_WEEK_SA;
    case "Su":
      return DataProto.DayOfWeek.DAY_OF_WEEK_SU;
    default:
      return DataProto.DayOfWeek.DAY_OF_WEEK_UNSPECIFIED;
  }
}

function prereqTypeToProto(type: string): number {
  switch (type) {
    case "course":
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_COURSE;
    case "or_group":
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_OR_GROUP;
    case "and_group":
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_AND_GROUP;
    case "non_course":
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_NON_COURSE;
    default:
      return DataProto.CoursePrereqNodeType.COURSE_PREREQ_NODE_TYPE_UNSPECIFIED;
  }
}

function requirementTypeToProto(type: string): number {
  const t = DataProto.RequirementType;
  switch (type) {
    case "course":
      return t.REQUIREMENT_TYPE_COURSE;
    case "elective":
      return t.REQUIREMENT_TYPE_ELECTIVE;
    case "group":
      return t.REQUIREMENT_TYPE_GROUP;
    case "pick":
      return t.REQUIREMENT_TYPE_PICK;
    case "options_group":
      return t.REQUIREMENT_TYPE_OPTIONS_GROUP;
    case "discipline_elective":
      return t.REQUIREMENT_TYPE_DISCIPLINE_ELECTIVE;
    case "free_elective":
      return t.REQUIREMENT_TYPE_FREE_ELECTIVE;
    case "non_discipline_elective":
      return t.REQUIREMENT_TYPE_NON_DISCIPLINE_ELECTIVE;
    case "faculty_elective":
      return t.REQUIREMENT_TYPE_FACULTY_ELECTIVE;
    case "section":
      return t.REQUIREMENT_TYPE_SECTION;
    case "and":
      return t.REQUIREMENT_TYPE_AND;
    case "or_group":
      return t.REQUIREMENT_TYPE_OR_GROUP;
    case "or_course":
      return t.REQUIREMENT_TYPE_OR_COURSE;
    default:
      return t.REQUIREMENT_TYPE_UNSPECIFIED;
  }
}

function sectionStatusToProto(status: unknown): number {
  if (status === "Open") return DataProto.SectionStatus.SECTION_STATUS_OPEN;
  if (status === "Closed") return DataProto.SectionStatus.SECTION_STATUS_CLOSED;
  return DataProto.SectionStatus.SECTION_STATUS_UNSPECIFIED;
}

function normalizeCode(value: unknown): string {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function mapPrereq(node: any): any {
  return {
    type: prereqTypeToProto(String(node.type ?? "")),
    code: node.code,
    text: node.text,
    credits: node.credits,
    disciplines: node.disciplines ?? [],
    levels: node.levels ?? [],
    disciplineLevels: (node.disciplineLevels ?? []).map((d: any) => ({
      discipline: d.discipline,
      levels: d.levels ?? [],
    })),
    programs: node.programs ?? [],
    children: (node.children ?? []).map(mapPrereq),
  };
}

function mapRequirement(req: any): any {
  return {
    type: requirementTypeToProto(String(req.type ?? "")),
    title: req.title,
    code: req.code,
    credits: req.credits,
    disciplineLevels: (req.disciplineLevels ?? []).map((d: any) => ({
      discipline: d.discipline,
      levels: d.levels ?? [],
    })),
    excludedDisciplines: req.excluded_disciplines ?? [],
    faculty: req.faculty,
    indented: req.indented,
    options: (req.options ?? []).map(mapRequirement),
  };
}

function mapCatalogue(input: any): any {
  const courseCodes: string[] = [];
  const indexByCode = new Map<string, number>();
  const addCode = (code: string): number => {
    const normalized = normalizeCode(code);
    const existing = indexByCode.get(normalized);
    if (existing !== undefined) return existing;
    const idx = courseCodes.length;
    courseCodes.push(normalized);
    indexByCode.set(normalized, idx);
    return idx;
  };

  for (const course of input.courses ?? []) {
    addCode(String(course.code ?? ""));
    for (const alias of course.aliases ?? []) addCode(String(alias ?? ""));
  }

  return {
    courseCodes,
    courses: (input.courses ?? []).map((course: any) => ({
      code: { index: addCode(String(course.code ?? "")) },
      title: course.title,
      credits: course.credits,
      component: course.component,
      aliases: (course.aliases ?? []).map((alias: unknown) => ({
        index: addCode(String(alias ?? "")),
      })),
      hasPrereqText: Boolean(course.prereqText),
      prerequisites: course.prerequisites ? mapPrereq(course.prerequisites) : undefined,
    })),
    programs: (input.programs ?? []).map((program: any) => ({
      title: program.title,
      programKey: program.slug ?? program.url ?? program.title,
      requirements: (program.requirements ?? []).map(mapRequirement),
    })),
  };
}

function mapLetterGradeDistributionToProto(dist: unknown): {
  aPlus: number;
  a: number;
  aMinus: number;
  bPlus: number;
  b: number;
  cPlus: number;
  c: number;
  dPlus: number;
  d: number;
  e: number;
  f: number;
  ein: number;
  ns: number;
  nc: number;
  abs: number;
  p: number;
  s: number;
} {
  const d = dist && typeof dist === "object" ? (dist as Record<string, unknown>) : {};
  const n = (k: string): number => {
    const v = d[k];
    const num = Number(v);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    aPlus: n("A+"),
    a: n("A"),
    aMinus: n("A-"),
    bPlus: n("B+"),
    b: n("B"),
    cPlus: n("C+"),
    c: n("C"),
    dPlus: n("D+"),
    d: n("D"),
    e: n("E"),
    f: n("F"),
    ein: n("EIN"),
    ns: n("NS"),
    nc: n("NC"),
    abs: n("ABS"),
    p: n("P"),
    s: n("S"),
  };
}

function mapSchedules(input: any): any {
  const courseCodes: string[] = [];
  const indexByCode = new Map<string, number>();
  const addCode = (code: string): number => {
    const normalized = normalizeCode(code);
    const existing = indexByCode.get(normalized);
    if (existing !== undefined) return existing;
    const idx = courseCodes.length;
    courseCodes.push(normalized);
    indexByCode.set(normalized, idx);
    return idx;
  };

  return {
    termId: parseTermIdToNumber(String(input.termId ?? "")),
    courseCodes,
    totalCourses: input.totalCourses,
    totalWithSchedules: input.totalWithSchedules,
    schedules: (input.schedules ?? []).map((schedule: any) => ({
      course: { index: addCode(String(schedule.courseCode ?? "")) },
      title: schedule.title ?? undefined,
      timeZone: schedule.timeZone,
      components: Object.fromEntries(
        Object.entries(schedule.components ?? {}).map(([component, sections]: [string, any]) => [
          component,
          {
            items: (sections ?? []).map((section: any) => ({
              section: section.section,
              sectionCode: section.sectionCode ?? undefined,
              component: section.component ?? undefined,
              session: section.session ?? undefined,
              times: (section.times ?? []).map((time: any) => ({
                day: dayToProto(time.day),
                startMinutes: time.startMinutes,
                endMinutes: time.endMinutes,
                virtual: Boolean(time.virtual),
                instructor: time.instructor ?? undefined,
                meetingDates:
                  Array.isArray(time.meetingDates) && time.meetingDates.length >= 2
                    ? {
                        startYyyymmdd: dateStringToYyyymmdd(String(time.meetingDates[0] ?? "")),
                        endYyyymmdd: dateStringToYyyymmdd(String(time.meetingDates[1] ?? "")),
                      }
                    : undefined,
              })),
              status: sectionStatusToProto(section.status),
              distribution: section.distribution
                ? mapLetterGradeDistributionToProto(section.distribution)
                : undefined,
            })),
          },
        ]),
      ),
    })),
  };
}

function mapGradesJson(rows: unknown[]) {
  if (!Array.isArray(rows)) {
    throw new Error("grades.json: expected top-level array");
  }
  return {
    courses: rows
      .map((row: unknown) => {
        const r = row as { code?: unknown; professors?: unknown };
        const profs = Array.isArray(r.professors) ? r.professors : [];
        return {
          code: normalizeCode(r.code),
          professors: profs
            .map((p: unknown) => {
              const x = p as {
                name?: unknown;
                legacyId?: unknown;
                termId?: unknown;
                distribution?: unknown;
                section?: unknown;
              };
              const termParsed = Number.parseInt(String(x.termId ?? ""), 10);
              const termId = Number.isFinite(termParsed) ? termParsed : 0;
              const sec =
                typeof x.section === "string" && x.section.trim() ? x.section.trim() : undefined;
              const legacyRaw = x.legacyId;
              let legacyId: number | undefined;
              if (typeof legacyRaw === "number" && Number.isFinite(legacyRaw)) {
                legacyId = legacyRaw;
              } else if (typeof legacyRaw === "string" && legacyRaw.trim()) {
                const parsed = Number.parseInt(legacyRaw, 10);
                legacyId = Number.isFinite(parsed) ? parsed : undefined;
              }
              return {
                name: String(x.name ?? ""),
                ...(legacyId !== undefined ? { legacyId } : {}),
                termId,
                distribution: mapLetterGradeDistributionToProto(x.distribution),
                section: sec,
              };
            })
            .filter((p) => p.termId !== 0 && String(p.name).trim().length > 0),
        };
      })
      .filter((c) => c.professors.length > 0),
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw) as T;
}

async function writePb(filePath: string, bytes: Uint8Array): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
}

function isCatalogueYearJson(name: string): boolean {
  return /^catalogue\.\d{4}\.json$/.test(name);
}

function isScheduleJson(name: string): boolean {
  return /^schedules\.\d+\.json$/.test(name);
}

async function main(): Promise<void> {
  await fs.mkdir(WEB_PUBLIC_DATA_DIR, { recursive: true });

  const entries = await fs.readdir(SCRAPER_DATA_DIR);
  const yearCatalogues = entries.filter(isCatalogueYearJson).sort();
  const scheduleFiles = entries.filter(isScheduleJson).sort();

  const manifest = await readJson<{ years: number[] }>(
    path.join(SCRAPER_DATA_DIR, "catalogue.json"),
  );
  await writePb(
    path.join(WEB_PUBLIC_DATA_DIR, "catalogue.pb"),
    DataProto.CatalogueManifest.encode({ years: manifest.years ?? [] }).finish(),
  );

  const terms = await readJson<{ terms: Array<{ termId: string; name: string }> }>(
    path.join(SCRAPER_DATA_DIR, "terms.json"),
  );
  await writePb(
    path.join(WEB_PUBLIC_DATA_DIR, "terms.pb"),
    DataProto.TermsData.encode({
      terms: (terms.terms ?? []).map((t) => ({
        termId: parseTermIdToNumber(String(t.termId ?? "")),
        name: t.name,
      })),
    }).finish(),
  );

  const indices = await readJson<{ courses: string[]; programs: string[] }>(
    path.join(SCRAPER_DATA_DIR, "indices.json"),
  );
  await writePb(
    path.join(WEB_PUBLIC_DATA_DIR, "indices.pb"),
    DataProto.Indices.encode({
      courses: indices.courses ?? [],
      programs: indices.programs ?? [],
    }).finish(),
  );

  const rmp = await readJson<{ resultCount: number; professors: any[] }>(
    path.join(SCRAPER_DATA_DIR, "ratemyprofessors.json"),
  );
  await writePb(
    path.join(WEB_PUBLIC_DATA_DIR, "ratemyprofessors.pb"),
    DataProto.RateMyProfessorsData.encode({
      resultCount: rmp.resultCount ?? 0,
      professors: (rmp.professors ?? []).map((p: any) => ({
        id: p.id ?? "",
        legacyId: p.legacyId,
        name: p.name,
        rating: p.rating ?? undefined,
        numRatings: p.numRatings,
      })),
    }).finish(),
  );

  for (const fileName of yearCatalogues) {
    const fullPath = path.join(SCRAPER_DATA_DIR, fileName);
    const data = await readJson<JsonObject>(fullPath);
    const encoded = DataProto.Catalogue.encode(mapCatalogue(data)).finish();
    await writePb(path.join(WEB_PUBLIC_DATA_DIR, fileName.replace(/\.json$/, ".pb")), encoded);
  }

  for (const fileName of scheduleFiles) {
    const fullPath = path.join(SCRAPER_DATA_DIR, fileName);
    const data = await readJson<JsonObject>(fullPath);
    const encoded = DataProto.SchedulesData.encode(mapSchedules(data)).finish();
    await writePb(path.join(WEB_PUBLIC_DATA_DIR, fileName.replace(/\.json$/, ".pb")), encoded);
  }

  const gradesJson = await readJson<unknown[]>(path.join(SCRAPER_DATA_DIR, "grades.json"));
  await writePb(
    path.join(WEB_PUBLIC_DATA_DIR, "grades.pb"),
    DataProto.GradesData.encode(mapGradesJson(gradesJson)).finish(),
  );

  console.log(
    `Generated protobuf data: ${yearCatalogues.length} catalogue files, ${scheduleFiles.length} schedule files, grades.pb`,
  );
}

main().catch((err) => {
  console.error("Failed to build protobuf data artifacts.");
  console.error(err);
  process.exit(1);
});
