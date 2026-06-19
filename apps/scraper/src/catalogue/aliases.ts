import { extractCourseCodes, normalizeCodeKey, normalizeWhitespace } from "../shared/text.ts";

export function extractPreviouslyAliases(combined: string, ownCode: string): string[] {
  const normalized = normalizeWhitespace(combined);
  if (!normalized) return [];
  const ownKey = normalizeCodeKey(ownCode);
  const re = /\b(?:Previously|Antérieurement)\s*:?\s*/gi;
  const codes = new Set<string>();
  let m: RegExpExecArray | null;
  while ((m = re.exec(normalized)) !== null) {
    const rest = normalized.slice(m.index + m[0].length);
    // The "Previously"/"Antérieurement" clause is a single sentence, so it ends
    // at the first sentence-terminating period. Scanning past that boundary would
    // incorrectly absorb course codes from neighbouring sentences (e.g. the
    // prerequisite list or a bilingual "/ Previously …" repetition), producing
    // bogus transitive aliases.
    const dotIdx = rest.indexOf(".");
    const segment = dotIdx === -1 ? rest : rest.slice(0, dotIdx);
    let segmentTrim = segment
      .replace(/^\(\s*/, "")
      .replace(/\s*\)\s*$/, "")
      .trim();
    segmentTrim = segmentTrim.replace(/\.\s*$/, "").trim();
    for (const c of extractCourseCodes(segmentTrim)) {
      if (normalizeCodeKey(c) !== ownKey) codes.add(c);
    }
  }
  return Array.from(codes);
}
