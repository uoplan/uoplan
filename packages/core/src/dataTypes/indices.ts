import type { Indices as ProtoIndices } from "@uoplan/proto/data";
import type { Indices } from "./domain";

// Columnar encoding for the indices.pb course/program lists. Course codes are
// `DISC NNNN[suffix]`; numbers are delta-encoded within each discipline and the
// discipline dictionary is derived from the course list itself so the encoding
// is self-consistent. This module is intentionally dependency-free (type-only
// imports) so it can be value-imported from the scraper's proto build, which
// runs the core source directly under Node's type-stripping loader.

const INDICES_COURSE_RE = /^([A-Za-z]+) (\d+)([A-Za-z]?)$/;

function indicesCoursePad(n: number): string {
  return String(n).padStart(4, "0");
}

export function toProtoIndices(input: Indices): ProtoIndices {
  // Derive the discipline dictionary from the course list (first-occurrence
  // order over the append-ordered courses), independent of input.disciplines so
  // the columnar encoding is self-consistent even if the JSON dict is stale.
  const disciplines: string[] = [];
  const discIndex = new Map<string, number>();
  for (const code of input.courses) {
    const disc = INDICES_COURSE_RE.exec(code)?.[1];
    if (disc !== undefined && !discIndex.has(disc)) {
      discIndex.set(disc, disciplines.length);
      disciplines.push(disc);
    }
  }

  const courseDiscipline: number[] = [];
  const courseNumberDelta: number[] = [];
  const courseSuffixPos: number[] = [];
  const courseSuffixChar: number[] = [];
  const courseLiteralPos: number[] = [];
  const courseLiteral: string[] = [];
  const prevByDiscipline = Array.from<number>({ length: disciplines.length }).fill(0);

  for (let i = 0; i < input.courses.length; i++) {
    const code = input.courses[i];
    const m = INDICES_COURSE_RE.exec(code);
    const disc = m?.[1];
    const di = disc !== undefined ? discIndex.get(disc) : undefined;
    const number = m ? Number(m[2]) : Number.NaN;
    // Encode columnar only when it round-trips exactly; otherwise overflow to a
    // literal so the original string is preserved verbatim.
    if (m && di !== undefined && `${disc} ${indicesCoursePad(number)}${m[3]}` === code) {
      courseDiscipline.push(di);
      courseNumberDelta.push(number - prevByDiscipline[di]);
      prevByDiscipline[di] = number;
      if (m[3]) {
        courseSuffixPos.push(i);
        courseSuffixChar.push(m[3].charCodeAt(0));
      }
    } else {
      courseDiscipline.push(disciplines.length);
      courseNumberDelta.push(0);
      courseLiteralPos.push(i);
      courseLiteral.push(code);
    }
  }

  const programPrefixLen: number[] = [];
  const programSuffix: string[] = [];
  let prevProgram = "";
  for (const program of input.programs) {
    const max = Math.min(prevProgram.length, program.length);
    let n = 0;
    while (n < max && prevProgram[n] === program[n]) n++;
    programPrefixLen.push(n);
    programSuffix.push(program.slice(n));
    prevProgram = program;
  }

  return {
    disciplines,
    courseDiscipline,
    courseNumberDelta,
    courseSuffixPos,
    courseSuffixChar,
    programPrefixLen,
    programSuffix,
    courseLiteralPos,
    courseLiteral,
  };
}

export function fromProtoIndices(input: ProtoIndices): Indices {
  const disciplines = input.disciplines;
  const suffixByPos = new Map<number, number>();
  for (let k = 0; k < input.courseSuffixPos.length; k++) {
    suffixByPos.set(Number(input.courseSuffixPos[k]), Number(input.courseSuffixChar[k] ?? 0));
  }
  const literalByPos = new Map<number, string>();
  for (let k = 0; k < input.courseLiteralPos.length; k++) {
    literalByPos.set(Number(input.courseLiteralPos[k]), input.courseLiteral[k] ?? "");
  }

  const prevByDiscipline = Array.from<number>({ length: disciplines.length }).fill(0);
  const courses = input.courseDiscipline.map((diRaw, i) => {
    const di = Number(diRaw);
    if (di >= disciplines.length || literalByPos.has(i)) {
      return literalByPos.get(i) ?? "";
    }
    const number = prevByDiscipline[di] + Number(input.courseNumberDelta[i] ?? 0);
    prevByDiscipline[di] = number;
    const suffixCode = suffixByPos.get(i);
    const suffix = suffixCode !== undefined ? String.fromCharCode(suffixCode) : "";
    return `${disciplines[di]} ${indicesCoursePad(number)}${suffix}`;
  });

  const programs: string[] = [];
  let prevProgram = "";
  for (let i = 0; i < input.programSuffix.length; i++) {
    const prefixLen = Number(input.programPrefixLen[i] ?? 0);
    const program = prevProgram.slice(0, prefixLen) + input.programSuffix[i];
    programs.push(program);
    prevProgram = program;
  }

  return { courses, programs, disciplines };
}
