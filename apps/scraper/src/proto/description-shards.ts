import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import { facultyIdFromName } from "@uoplan/core/facultyIdentity";
import type * as DataProto from "@uoplan/proto/data";
import type { CatalogueJsonInput } from "./catalogue.ts";

/**
 * The 13 canonical shard identifiers: 12 faculty slugs + "other".
 * Order is load-bearing — do not reorder without updating downstream consumers.
 */
export const COURSE_DESCRIPTION_SHARD_IDS = [
  "arts",
  "education",
  "engineering",
  "health-sciences",
  "law",
  "law-civil-law",
  "law-common-law",
  "medicine",
  "science",
  "social-sciences",
  "telfer-school-of-management",
  "vice-rector-academic",
  "other",
] as const;

export type CourseDescriptionShardId = (typeof COURSE_DESCRIPTION_SHARD_IDS)[number];

const SHARD_ID_SET: ReadonlySet<string> = new Set(COURSE_DESCRIPTION_SHARD_IDS);

/**
 * Normalize a raw description string: collapse interior whitespace runs to a
 * single ASCII space and trim leading/trailing whitespace. Does not alter
 * punctuation, accents, or catalogue defects.
 */
function normalizeDescription(raw: string): string {
  return raw.replaceAll(/\s+/g, " ").trim();
}

/**
 * Merge all catalogue years (oldest → newest) and return the newest non-empty
 * description for each normalized course code. An empty (or whitespace-only)
 * description in a newer catalogue does not erase an older non-empty value.
 *
 * Course codes are normalized via {@link normalizeCourseCode} (e.g. "mat1320" →
 * "MAT 1320"). Descriptions have interior whitespace collapsed to one ASCII
 * space and are trimmed; punctuation, accents, and catalogue defects are
 * preserved verbatim.
 */
export function collectLatestCourseDescriptions(
  catalogues: readonly CatalogueJsonInput[],
): ReadonlyMap<string, string> {
  const result = new Map<string, string>();

  for (const catalogue of catalogues) {
    for (const course of catalogue.courses ?? []) {
      const rawCode = typeof course.code === "string" ? course.code : "";
      if (!rawCode) continue;
      const code = normalizeCourseCode(rawCode);
      const raw =
        typeof (course as { description?: unknown }).description === "string"
          ? (course as { description: string }).description
          : "";
      const description = normalizeDescription(raw);
      if (description) {
        result.set(code, description);
      }
    }
  }

  return result;
}

/**
 * Build a map from each of the 13 {@link CourseDescriptionShardId}s to its
 * {@link DataProto.CourseDescriptionShard}. All 13 shards are pre-created
 * (empty shards have zero-length parallel arrays). Within each shard the
 * entries are sorted ascending by normalized course code so output is
 * deterministic.
 *
 * A course is assigned to the shard matching its discipline's `facultyId`
 * (derived from the faculty name in {@link DataProto.DisciplinesData}).
 * Courses whose discipline is absent from the data, or whose faculty maps to
 * a slug not in {@link COURSE_DESCRIPTION_SHARD_IDS}, go to the `"other"` shard.
 */
export function buildCourseDescriptionShards(
  descriptions: ReadonlyMap<string, string>,
  disciplines: DataProto.DisciplinesData,
): ReadonlyMap<CourseDescriptionShardId, DataProto.CourseDescriptionShard> {
  // Build discipline-code → faculty shard-id lookup.
  const disciplineToShard = new Map<string, CourseDescriptionShardId>();
  for (const disc of disciplines.disciplines) {
    if (!disc.code) continue;
    const ref = disc.facultyRef;
    if (!ref || ref < 1 || ref > disciplines.faculties.length) {
      disciplineToShard.set(disc.code, "other");
      continue;
    }
    const faculty = disciplines.faculties[ref - 1];
    const id = facultyIdFromName(faculty.name);
    const shardId: CourseDescriptionShardId =
      id !== null && SHARD_ID_SET.has(id) ? (id as CourseDescriptionShardId) : "other";
    disciplineToShard.set(disc.code, shardId);
  }

  // Accumulate entries per shard.
  const buckets = new Map<CourseDescriptionShardId, { code: string; description: string }[]>();
  for (const id of COURSE_DESCRIPTION_SHARD_IDS) {
    buckets.set(id, []);
  }

  for (const [code, description] of descriptions) {
    const disciplineCode = code.split(" ")[0] ?? "";
    const shardId: CourseDescriptionShardId = disciplineToShard.get(disciplineCode) ?? "other";
    buckets.get(shardId)!.push({ code, description });
  }

  // Sort each bucket and build the proto message.
  const result = new Map<CourseDescriptionShardId, DataProto.CourseDescriptionShard>();
  for (const id of COURSE_DESCRIPTION_SHARD_IDS) {
    const entries = buckets.get(id)!;
    entries.sort((a, b) => (a.code < b.code ? -1 : a.code > b.code ? 1 : 0));
    result.set(id, {
      courseCodes: entries.map((e) => e.code),
      descriptions: entries.map((e) => e.description),
    });
  }

  return result;
}
