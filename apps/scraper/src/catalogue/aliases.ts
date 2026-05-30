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
    let segment: string;
    const boundaryWithSentence = rest.match(
      /^([\s\S]*?)(?=\.\s+(?:They|The|Students|Reserved|Priority|Consult|Supplemental|It |Also |The courses |Réservé|Les cours ))/,
    );
    if (boundaryWithSentence) {
      segment = boundaryWithSentence[1];
    } else {
      const dotIdx = rest.indexOf(".");
      segment = dotIdx === -1 ? rest : rest.slice(0, dotIdx);
    }
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
