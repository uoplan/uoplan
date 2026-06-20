import type { File as FileType, Paths as PathsType } from "expo-file-system";

/** File (under the persistent document dir) the completed course codes live in. */
const COMPLETED_FILE = "uoplan-completed.json";

/**
 * Parse persisted completed-courses JSON into a deduped list of course-code
 * strings. Tolerates any malformed shape (returns `[]`) so a corrupt file
 * degrades to an empty list rather than throwing.
 */
export function parseCompletedCourses(text: string): string[] {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item === "string" && !seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

// `expo-file-system` is required lazily (not statically imported) so the store
// stays out of the jest render-test module graph — the same pattern used by
// `data/basket-storage.ts`. apps/native is excluded from oxlint, so require() is fine.
function fileSystem(): { File: typeof FileType; Paths: typeof PathsType } {
  return require("expo-file-system");
}

/** Load the persisted completed courses from disk (best-effort; `[]` on failure). */
export async function readCompletedCourses(): Promise<string[]> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, COMPLETED_FILE);
    if (!file.exists) return [];
    return parseCompletedCourses(await file.text());
  } catch {
    return [];
  }
}

/** Persist the completed courses to disk (best-effort; failures are swallowed). */
export async function writeCompletedCourses(codes: string[]): Promise<void> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, COMPLETED_FILE);
    file.write(JSON.stringify(codes));
  } catch {
    // best-effort: a failed write must not break the UI.
  }
}
