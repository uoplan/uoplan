import type { File as FileType, Paths as PathsType } from "expo-file-system";

/** File (under the persistent document dir) the basket course codes live in. */
const BASKET_FILE = "uoplan-basket.json";

/**
 * Parse persisted basket JSON into a deduped list of course-code strings.
 * Tolerates any malformed shape (returns `[]`) so a corrupt file degrades to an
 * empty basket rather than throwing.
 */
export function parseBasket(text: string): string[] {
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

/** Toggle a code in a basket list (pure): add when absent, remove when present. */
export function toggleCode(codes: string[], code: string): string[] {
  return codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code];
}

// `expo-file-system` is required lazily (not statically imported) so the basket
// store stays out of the jest render-test module graph — the same pattern used
// by `lib/push.ts`. apps/native is excluded from oxlint, so require() is fine.
function fileSystem(): { File: typeof FileType; Paths: typeof PathsType } {
  return require("expo-file-system");
}

/** Load the persisted basket from disk (best-effort; `[]` on any failure). */
export async function readBasket(): Promise<string[]> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, BASKET_FILE);
    if (!file.exists) return [];
    return parseBasket(await file.text());
  } catch {
    return [];
  }
}

/** Persist the basket to disk (best-effort; failures are swallowed). */
export async function writeBasket(codes: string[]): Promise<void> {
  try {
    const { File, Paths } = fileSystem();
    const file = new File(Paths.document, BASKET_FILE);
    file.write(JSON.stringify(codes));
  } catch {
    // best-effort: a failed write must not break the UI.
  }
}
