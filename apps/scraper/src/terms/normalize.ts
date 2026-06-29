/**
 * uOttawa labels the May–August term "Spring/Summer Term", which is too long for
 * our term pickers. Collapse the "Spring/Summer" segment down to just "Summer"
 * (e.g. "2026 Spring/Summer Term" → "2026 Summer Term"). Applied both when
 * syncing terms.json from the live dropdown and when compiling terms.pb, so no
 * "Spring/Summer" label can leak into the runtime data or the UI.
 */
export function normalizeTermName(name: string): string {
  return name.replaceAll(/spring\s*\/\s*summer/gi, "Summer");
}
