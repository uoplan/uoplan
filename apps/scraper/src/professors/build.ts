/**
 * File-IO orchestration for the canonical professor registry: reads every
 * professor-name source (RateMyProfessors, grades, schedules, feedback) plus the
 * optional committed overrides, builds the registry, and writes the committed
 * `data/professors.json`. The proto build later reads that file and derives a
 * resolver (see `createResolverFromRegistry`) to map each dataset's professor
 * references to registry indices.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { SchoolId } from "@uoplan/domain/school";
import { getSchool } from "@uoplan/domain/school";

import { normalizeCarletonInstructorName } from "../schools/carleton/rateMyProfessors.ts";
import { readJson } from "../shared/json.ts";
import {
  feedbackDataDir,
  gradesFile,
  rateMyProfessorsFile,
  schedulesDataDir,
  scraperDataDir,
} from "../shared/paths.ts";
import { buildProfessorRegistry } from "./buildRegistry.ts";
import type {
  NamedInput,
  ProfessorRegistryEntry,
  RegistryInputs,
  RegistryOverrides,
  RmpInput,
} from "./buildRegistry.ts";

export function professorsFile(school: SchoolId): string {
  return path.join(scraperDataDir(school), "professors.json");
}

function professorsOverridesFile(school: SchoolId): string {
  return path.join(scraperDataDir(school), "professors.overrides.json");
}

interface RmpFile {
  professors?: RmpInput[];
}

interface GradesCourse {
  sections?: Array<{ name?: string; legacyId?: number }>;
  /** Backward-compatible reader for committed legacy grades.json until regenerated. */
  professors?: Array<{ name?: string; legacyId?: number }>;
}

interface ScheduleFile {
  schedules?: Array<{
    components?: Record<string, Array<{ times?: Array<{ instructor?: string | null }> }>>;
  }>;
}

interface FeedbackCourse {
  sections?: Array<{ professor?: string }>;
}

async function readJsonOptional<T>(file: string): Promise<T | null> {
  try {
    return await readJson<T>(file);
  } catch (err) {
    if ((err as NodeJS.ErrnoException)?.code === "ENOENT") return null;
    throw err;
  }
}

async function listJsonFiles(dir: string, prefix: RegExp): Promise<string[]> {
  const entries = await fs.readdir(dir).catch(() => [] as string[]);
  return entries.filter((name) => prefix.test(name)).sort();
}

/** Gather every professor-name source into the registry-builder input shape. */
async function collectRegistryInputs(school: SchoolId): Promise<RegistryInputs> {
  const features = getSchool(school).features;
  const rmp = (await readJsonOptional<RmpFile>(rateMyProfessorsFile(school)))?.professors ?? [];

  const gradesJson = features.grades
    ? ((await readJsonOptional<GradesCourse[]>(gradesFile(school))) ?? [])
    : [];
  const grades: NamedInput[] = [];
  for (const course of gradesJson) {
    for (const prof of course.sections ?? course.professors ?? []) {
      if (prof?.name) grades.push({ name: prof.name, legacyId: prof.legacyId });
    }
  }

  const schedules: string[] = [];
  const scheduleDir = schedulesDataDir(school);
  const normalizeInstructor =
    school === "carleton"
      ? (name: string) => normalizeCarletonInstructorName(name)
      : (name: string) => name;
  for (const fileName of await listJsonFiles(scheduleDir, /^schedules\.\d+\.json$/)) {
    const data = await readJson<ScheduleFile>(path.join(scheduleDir, fileName));
    for (const course of data.schedules ?? []) {
      for (const sections of Object.values(course.components ?? {})) {
        for (const section of sections) {
          for (const time of section.times ?? []) {
            if (time.instructor) schedules.push(normalizeInstructor(time.instructor));
          }
        }
      }
    }
  }

  const feedback: string[] = [];
  if (features.feedback) {
    const feedbackDir = feedbackDataDir(school);
    for (const fileName of await listJsonFiles(feedbackDir, /^feedback\.\d+\.json$/)) {
      const data = await readJson<FeedbackCourse[]>(path.join(feedbackDir, fileName));
      for (const course of data) {
        for (const section of course.sections ?? []) {
          if (section.professor) feedback.push(section.professor);
        }
      }
    }
  }

  const overrides =
    (await readJsonOptional<RegistryOverrides>(professorsOverridesFile(school))) ?? {};

  return { rmp, grades, schedules, feedback, overrides };
}

/** Build the registry from all committed sources and write data/professors.json. */
export async function buildAndWriteProfessors(school: SchoolId): Promise<ProfessorRegistryEntry[]> {
  const inputs = await collectRegistryInputs(school);
  const professors = buildProfessorRegistry(inputs);
  await fs.writeFile(
    professorsFile(school),
    `${JSON.stringify({ professors }, null, 2)}\n`,
    "utf-8",
  );
  return professors;
}
