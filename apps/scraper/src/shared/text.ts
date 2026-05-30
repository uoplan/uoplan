export function normalizeWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export const COURSE_CODE_RE = /\b([A-Z]{3,4})\s*(\d{4,5}[A-Z]?)\b/g;

export function extractCourseCodes(text: string): string[] {
  const re = new RegExp(COURSE_CODE_RE.source, COURSE_CODE_RE.flags);
  const codes: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    codes.push(`${m[1]} ${m[2]}`.replace(/\s+/, " ").trim());
  }
  return Array.from(new Set(codes));
}

export function normalizeCodeKey(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}
