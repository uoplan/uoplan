import type {
  Catalogue as ProtoCatalogue,
  CatalogueProgramHistory as ProtoCatalogueProgramHistory,
  Program as ProtoProgram,
} from "@uoplan/proto/data";
import { fromProtoCatalogue } from "./schedules";
import type { Program } from "./domain";

/** Resolve a programs-only proto catalogue (courses stripped) to domain programs,
 * reusing the shared code-ref resolution in {@link fromProtoCatalogue}. */
function resolvePrograms(
  courseCodes: readonly string[],
  extraCodes: readonly string[],
  programs: ProtoProgram[],
): Program[] {
  return fromProtoCatalogue({
    courseCodes: [...courseCodes],
    extraCodes: [...extraCodes],
    courses: [],
    programs,
  }).programs;
}

/**
 * Reconstructs the program list for a specific cohort `year` from the union
 * catalogue (which carries the LATEST year's programs) plus the compact
 * program-history overlay. The programs analogue of
 * {@link reconstructCatalogueForYear}: a program present in a year with the
 * union value uses the union's program unchanged; a drifted value uses the
 * overlay revision; a program absent that year is omitted. Programs no longer in
 * the latest catalogue (history-only) are appended from the overlay.
 *
 * Untracked years (including — for a null overlay — every year) return the
 * union's latest programs unchanged.
 *
 * Order: union program order first (present programs only), then history-only
 * programs in overlay order. This differs cosmetically from the old per-year
 * asset order, but share-link/state decoding resolves programs by slug, not
 * position, so it is behaviourally safe.
 */
export function reconstructProgramsForYear(
  union: ProtoCatalogue,
  history: ProtoCatalogueProgramHistory | null | undefined,
  year: number,
): Program[] {
  const bit = history ? history.years.indexOf(year) : -1;
  if (!history || bit < 0) return fromProtoCatalogue(union).programs;

  const mask = 1 << bit;

  // Union baseline programs, resolved once against the union's own code space.
  const baseline = fromProtoCatalogue(union).programs;

  // This year's overlay revisions (proto), resolved once against the overlay's
  // extra_codes. Keyed by program key for assembly below.
  const revisionProto: ProtoProgram[] = [];
  const overlayByKey = new Map<string, (typeof history.overlays)[number]>();
  for (const overlay of history.overlays) {
    overlayByKey.set(overlay.programKey, overlay);
    const revision = overlay.revisions.find((r) => (r.yearMask & mask) !== 0);
    if (revision?.program) revisionProto.push(revision.program);
  }
  const revisionByKey = new Map<string, Program>();
  for (const program of resolvePrograms(union.courseCodes, history.extraCodes, revisionProto)) {
    if (program.slug) revisionByKey.set(program.slug, program);
  }

  const unionKeys = new Set<string>();
  const result: Program[] = [];
  for (const program of baseline) {
    const key = program.slug ?? "";
    unionKeys.add(key);
    const overlay = overlayByKey.get(key);
    if (!overlay) {
      // Fully-stable union program: present with the baseline value every year.
      result.push(program);
      continue;
    }
    const revision = revisionByKey.get(key);
    if (revision) {
      result.push(revision);
      continue;
    }
    if ((overlay.baselinePresentMask & mask) !== 0) result.push(program);
    // else: absent this cohort year.
  }

  // History-only programs (dropped before the latest catalogue).
  for (const overlay of history.overlays) {
    if (unionKeys.has(overlay.programKey)) continue;
    const revision = revisionByKey.get(overlay.programKey);
    if (revision) result.push(revision);
  }

  return result;
}
