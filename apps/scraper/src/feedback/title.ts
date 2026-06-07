import { normalizeWhitespace } from "../shared/text.ts";

/**
 * Parse a course-evaluation report-list row title into the professor and the
 * one-or-more (course, section, title) tuples it was evaluated on.
 *
 * Title grammar (English and French portals):
 *   "Course Evaluation Report for <Last, First> (CODE SEC Course Title[, CODE SEC Course Title]*)"
 *   "Rapport d'evaluation de cours pour <Last, First> (CODE SEC Titre, ...)"
 *
 * The professor + every (code, section) pair are encoded here, so the list
 * alone yields the prof <-> section <-> course join key with no per-report fetch.
 */

interface ParsedCourse {
  /** Normalized to grades.json format, e.g. "FEM 1100". */
  code: string;
  /** Section code, e.g. "B00", "NG00". */
  section: string;
  /** Course title text (may contain commas / colons). */
  title: string;
}

interface ParsedReportTitle {
  /** Display order "First Last" (matches grades.json), e.g. "Helen Abbot". */
  professor: string;
  courses: ParsedCourse[];
}

const PREFIX_RE = /\b(?:for|pour)\b\s+/i;
const COURSE_RE =
  /([A-Z]{2,4})\s?(\d{3,5}[A-Z]?)\s+([A-Z0-9]{1,5})\s+(.*?)(?=,\s*[A-Z]{2,4}\s?\d{3,5}[A-Z]?\s+[A-Z0-9]{1,5}\b|$)/g;

export function parseReportTitle(rawTitle: string): ParsedReportTitle | null {
  const title = normalizeWhitespace(rawTitle);
  const prefix = PREFIX_RE.exec(title);
  if (!prefix) return null;

  const afterFor = title.slice(prefix.index + prefix[0].length);
  const open = afterFor.indexOf("(");
  const close = afterFor.lastIndexOf(")");
  if (open === -1 || close === -1 || close <= open) return null;

  const professor = formatProfessor(afterFor.slice(0, open));
  const inner = afterFor.slice(open + 1, close);
  const courses = parseCourses(inner);
  if (!professor || courses.length === 0) return null;

  return { professor, courses };
}

export function parseCourses(inner: string): ParsedCourse[] {
  const courses: ParsedCourse[] = [];
  const re = new RegExp(COURSE_RE.source, COURSE_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(inner)) !== null) {
    if (m[0].trim() === "") {
      re.lastIndex += 1;
      continue;
    }
    courses.push({
      code: `${m[1]} ${m[2]}`,
      section: m[3],
      title: m[4].replace(/[,\s]+$/, "").trim(),
    });
  }
  return courses;
}

function formatProfessor(raw: string): string {
  const name = normalizeWhitespace(raw);
  const comma = name.indexOf(",");
  if (comma === -1) return name;
  const last = name.slice(0, comma).trim();
  const first = name.slice(comma + 1).trim();
  return normalizeWhitespace(`${first} ${last}`);
}
