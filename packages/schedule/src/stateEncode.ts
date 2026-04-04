import type { Program, DayOfWeek } from 'schemas';
import type { CourseLevelBucket, CourseLanguageBucket } from './courseFilters';
import type { RemainingRequirement, RequirementWithStatus } from './requirements';
import type { Indices } from 'schemas';
import { isOptCourse, getCourseLevel } from './utils/courseUtils';

export function requirementIdsFromTree(nodes: RequirementWithStatus[]): string[] {
  const out: string[] = [];
  function walk(n: RequirementWithStatus[]) {
    for (const node of n) {
      if (node.requirementId) out.push(node.requirementId);
      if (node.options?.length) walk(node.options);
    }
  }
  walk(nodes);
  return out;
}

export function urlToSlug(url: string): string {
  return url
    .replace(/^https?:\/\/catalogue\.uottawa\.ca(?:\/archive\/\d{4}-\d{4})?\/en\//, '')
    .replace(/\/$/, '');
}

function programSlug(p: Program): string {
  return (p as Program & { slug?: string }).slug ?? urlToSlug(p.url);
}

const VERSION = 10;
const MAX_U16 = 0xffff;
const MAX_U32 = 0xffffffff;
const OPT_SENTINEL_BASE = 0xFFF0;

export interface EncodeInput {
  wizardMode: "basic" | "advanced" | null;
  basicPinnedCourses: string[];
  basicElectivesCount: number;
  basicExcludedCategories: string[];

  selectedTermId: string | null;
  firstYear: number | null;
  program: Program | null;
  minorProgram: Program | null;
  completedCourses: string[];
  levelBuckets: CourseLevelBucket[];
  languageBuckets: CourseLanguageBucket[];
  electiveLevelBuckets: number[];
  coursesThisSemester: number;
  selectedScheduleIndex: number;
  generationSeed: number;
  selectedPerRequirement: Record<string, string[]>;
  selectedOptionsPerRequirement: Record<string, number>;
  constrainedPerRequirement: Record<string, string[]>;
  requirementTreeWithStatus: RequirementWithStatus[];
  remainingRequirements: RemainingRequirement[];
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  studentPrograms: string[];

  requirementSlotsUserTouched: Record<string, true>;
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  generationAllowedDays: DayOfWeek[];
  generationMinProfessorRating: number | null;
  generationLimitFirstYearCredits: boolean;
  generationCompressedSchedule: boolean;
}

export interface DecodedState {
  wizardMode: "basic" | "advanced" | null;
  basicPinnedCourses: string[];
  basicElectivesCount: number;
  basicExcludedCategories: string[];

  selectedTermId: string | null;
  firstYear: number | null;
  program: Program | null;
  minorProgram: Program | null;
  completedCourseCodes: string[];
  levelBuckets: CourseLevelBucket[];
  languageBuckets: CourseLanguageBucket[];
  electiveLevelBuckets: number[];
  coursesThisSemester: number;
  selectedScheduleIndex: number;
  generationSeed: number;
  optionSelections: Array<{ reqIndex: number; optionIndex: number }>;
  courseSelections: Array<{ reqIndex: number; courseCodes: string[] }>;
  constrainedSelections: Array<{ reqIndex: number; courseCodes: string[] }>;
  includeClosedComponents: boolean;
  virtualSectionsOnly: boolean;
  studentPrograms: string[];

  touchedReqIndices: number[];
  generationMinStartMinutes: number;
  generationMaxEndMinutes: number;
  generationAllowedDays: DayOfWeek[];
  generationMinProfessorRating: number | null;
  generationLimitFirstYearCredits: boolean;
  generationCompressedSchedule: boolean;
}

export interface CatalogueLike {
  courses: Array<{ code: string }>;
  programs: Program[];
}

function levelToByte(b: CourseLevelBucket): number {
  return b === 'undergrad' ? 0 : 1;
}
function byteToLevel(b: number): CourseLevelBucket {
  return b === 0 ? 'undergrad' : 'grad';
}

function langToByte(b: CourseLanguageBucket): number {
  if (b === 'en') return 0;
  if (b === 'fr') return 1;
  return 2;
}
function byteToLang(b: number): CourseLanguageBucket {
  if (b === 0) return 'en';
  if (b === 1) return 'fr';
  return 'other';
}

function dayToBit(d: DayOfWeek): number {
  const days: DayOfWeek[] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  return 1 << days.indexOf(d);
}

function bitToDays(b: number): DayOfWeek[] {
  const days: DayOfWeek[] = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
  const res: DayOfWeek[] = [];
  for (let i = 0; i < days.length; i++) {
    if ((b & (1 << i)) !== 0) res.push(days[i]);
  }
  return res;
}

function writeU16(view: DataView, offset: number, value: number): number {
  view.setUint16(offset, value, true);
  return offset + 2;
}

function writeU8(view: DataView, offset: number, value: number): number {
  view.setUint8(offset, value);
  return offset + 1;
}

function writeU32(view: DataView, offset: number, value: number): number {
  view.setUint32(offset, value >>> 0, true);
  return offset + 4;
}

function readU16(view: DataView, offset: number): { value: number; next: number } {
  return { value: view.getUint16(offset, true), next: offset + 2 };
}

function readU8(view: DataView, offset: number): { value: number; next: number } {
  return { value: view.getUint8(offset), next: offset + 1 };
}

function readU32(view: DataView, offset: number): { value: number; next: number } {
  return { value: view.getUint32(offset, true), next: offset + 4 };
}

function writeString(view: DataView, offset: number, str: string): number {
  let off = offset;
  off = writeU8(view, off, Math.min(255, str.length));
  for (let i = 0; i < Math.min(255, str.length); i++) {
    off = writeU8(view, off, str.charCodeAt(i));
  }
  return off;
}

function readString(view: DataView, offset: number, maxLen: number): { value: string; next: number } {
  let off = offset;
  const { value: len, next: n1 } = readU8(view, off);
  off = n1;
  let str = '';
  for (let i = 0; i < len && i < maxLen; i++) {
    const { value: ch, next: n2 } = readU8(view, off);
    off = n2;
    str += String.fromCharCode(ch);
  }
  return { value: str, next: off };
}

export function encodeState(
  input: EncodeInput,
  _catalogue: CatalogueLike,
  indices: Indices
): Uint8Array | null {
  const programIndex =
    input.program != null
      ? indices.programs.indexOf(programSlug(input.program))
      : -1;
  if (input.program != null && programIndex < 0) return null;

  const minorProgramIndex =
    input.minorProgram != null
      ? indices.programs.indexOf(programSlug(input.minorProgram))
      : -1;
  if (input.minorProgram != null && minorProgramIndex < 0) return null;

  const courseCodeToIndex = new Map<string, number>();
  indices.courses.forEach((code, i) => courseCodeToIndex.set(code, i));

  for (const code of input.completedCourses) {
    if (!isOptCourse(code) && !courseCodeToIndex.has(code)) return null;
  }
  for (const code of input.basicPinnedCourses) {
    if (!courseCodeToIndex.has(code)) return null;
  }

  const termIdBytes = input.selectedTermId
    ? Array.from(input.selectedTermId).map(c => c.charCodeAt(0))
    : [];

  const orderedReqIds = requirementIdsFromTree(input.requirementTreeWithStatus);
  const reqIdToIndex = new Map<string, number>();
  orderedReqIds.forEach((id, i) => reqIdToIndex.set(id, i));

  const buffer = new ArrayBuffer(65536);
  const view = new DataView(buffer);
  let off = 0;

  off = writeU8(view, off, VERSION);

  off = writeU8(view, off, Math.min(255, termIdBytes.length));
  for (const b of termIdBytes) off = writeU8(view, off, b);

  off = writeU16(view, off, input.firstYear != null ? input.firstYear : 0);
  off = writeU16(view, off, programIndex === -1 ? MAX_U16 : programIndex);
  off = writeU16(view, off, minorProgramIndex === -1 ? MAX_U16 : minorProgramIndex);

  const completed = input.completedCourses.map((c) => {
    if (isOptCourse(c)) return OPT_SENTINEL_BASE + Math.floor((getCourseLevel(c) ?? 1000) / 1000);
    return courseCodeToIndex.get(c)!;
  });
  off = writeU16(view, off, completed.length);
  for (const idx of completed) off = writeU16(view, off, idx);

  off = writeU8(view, off, input.levelBuckets.length);
  for (const b of input.levelBuckets) off = writeU8(view, off, levelToByte(b));

  off = writeU8(view, off, input.languageBuckets.length);
  for (const b of input.languageBuckets) off = writeU8(view, off, langToByte(b));

  off = writeU8(view, off, input.electiveLevelBuckets.length);
  for (const v of input.electiveLevelBuckets) off = writeU16(view, off, v);

  off = writeU8(view, off, Math.min(255, input.coursesThisSemester));
  off = writeU16(view, off, Math.min(MAX_U16, input.selectedScheduleIndex));
  off = writeU32(view, off, Math.min(MAX_U32, input.generationSeed >>> 0));
  off = writeU8(view, off, input.includeClosedComponents ? 1 : 0);
  off = writeU8(view, off, input.virtualSectionsOnly ? 1 : 0);

  const optEntries = Object.entries(input.selectedOptionsPerRequirement)
    .map(([reqId, optionIndex]) => {
      const reqIndex = reqIdToIndex.get(reqId);
      return reqIndex !== undefined ? { reqIndex, optionIndex } : null;
    })
    .filter((e): e is { reqIndex: number; optionIndex: number } => e !== null);
  off = writeU16(view, off, optEntries.length);
  for (const { reqIndex, optionIndex } of optEntries) {
    off = writeU16(view, off, reqIndex);
    off = writeU16(view, off, optionIndex);
  }

  const courseEntries: Array<{ reqIndex: number; courseIndices: number[] }> = [];
  for (const [reqId, codes] of Object.entries(input.selectedPerRequirement)) {
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex === undefined) continue;
    const courseIndices = codes
      .map((c) => {
        if (isOptCourse(c)) return OPT_SENTINEL_BASE + Math.floor((getCourseLevel(c) ?? 1000) / 1000);
        return courseCodeToIndex.get(c);
      })
      .filter((i): i is number => i !== undefined);
    if (courseIndices.length) courseEntries.push({ reqIndex, courseIndices });
  }
  off = writeU16(view, off, courseEntries.length);
  for (const { reqIndex, courseIndices } of courseEntries) {
    off = writeU16(view, off, reqIndex);
    off = writeU16(view, off, courseIndices.length);
    for (const idx of courseIndices) off = writeU16(view, off, idx);
  }

  off = writeU8(view, off, Math.min(255, input.studentPrograms.length));
  for (const code of input.studentPrograms) {
    off = writeString(view, off, code);
  }

  const constrainedEntries: Array<{ reqIndex: number; courseIndices: number[] }> = [];
  for (const [reqId, codes] of Object.entries(input.constrainedPerRequirement)) {
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex === undefined) continue;
    const courseIndices = codes
      .map((c) => {
        if (isOptCourse(c)) return OPT_SENTINEL_BASE + Math.floor((getCourseLevel(c) ?? 1000) / 1000);
        return courseCodeToIndex.get(c);
      })
      .filter((i): i is number => i !== undefined);
    if (courseIndices.length) constrainedEntries.push({ reqIndex, courseIndices });
  }
  off = writeU16(view, off, constrainedEntries.length);
  for (const { reqIndex, courseIndices } of constrainedEntries) {
    off = writeU16(view, off, reqIndex);
    off = writeU16(view, off, courseIndices.length);
    for (const idx of courseIndices) off = writeU16(view, off, idx);
  }

  off = writeU8(view, off, input.wizardMode === "basic" ? 1 : input.wizardMode === "advanced" ? 2 : 0);

  const basicPinned = input.basicPinnedCourses
    .map(c => courseCodeToIndex.get(c))
    .filter((i): i is number => i !== undefined);
  off = writeU16(view, off, basicPinned.length);
  for (const idx of basicPinned) {
    off = writeU16(view, off, idx);
  }

  off = writeU8(view, off, input.basicElectivesCount);

  off = writeU16(view, off, input.basicExcludedCategories.length);
  for (const cat of input.basicExcludedCategories) {
    off = writeString(view, off, cat);
  }

  const touchedReqs: number[] = [];
  for (const reqId of Object.keys(input.requirementSlotsUserTouched)) {
    const reqIndex = reqIdToIndex.get(reqId);
    if (reqIndex !== undefined) touchedReqs.push(reqIndex);
  }
  off = writeU16(view, off, touchedReqs.length);
  for (const idx of touchedReqs) {
    off = writeU16(view, off, idx);
  }

  off = writeU16(view, off, input.generationMinStartMinutes);
  off = writeU16(view, off, input.generationMaxEndMinutes);

  let daysBitmask = 0;
  for (const d of input.generationAllowedDays) {
    daysBitmask |= dayToBit(d);
  }
  off = writeU8(view, off, daysBitmask);

  const ratingU8 = input.generationMinProfessorRating === null ? 255 : Math.round(input.generationMinProfessorRating * 10);
  off = writeU8(view, off, ratingU8);

  off = writeU8(view, off, input.generationLimitFirstYearCredits ? 1 : 0);
  off = writeU8(view, off, input.generationCompressedSchedule ? 1 : 0);

  return new Uint8Array(buffer, 0, off);
}

export type DecodeError = { error: string };

export function peekTermAndYear(
  bytes: Uint8Array
): { termId: string | null; firstYear: number | null } | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.length < 1) return null;
  const version = view.getUint8(0);
  if (version !== VERSION) return null;
  let off = 1;

  if (off + 1 > bytes.length) return null;
  const termIdLen = view.getUint8(off++);
  if (off + termIdLen + 2 > bytes.length) return null;

  let termId: string | null = null;
  if (termIdLen > 0) {
    let s = '';
    for (let i = 0; i < termIdLen; i++) s += String.fromCharCode(view.getUint8(off + i));
    termId = s;
  }
  off += termIdLen;

  const firstYearRaw = view.getUint16(off, true);
  const firstYear = firstYearRaw === 0 ? null : firstYearRaw;

  return { termId, firstYear };
}

export function decodeState(
  buffer: Uint8Array,
  catalogue: CatalogueLike,
  indices: Indices
): DecodedState | DecodeError {
  const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  let off = 0;
  
  if (buffer.length < 1) return { error: 'Invalid state: too short' };
  const { value: version, next: n0 } = readU8(view, off);
  off = n0;
  if (version !== VERSION) {
    return { error: 'Invalid or unsupported state version' };
  }

  const { value: termIdLen, next: n0b } = readU8(view, off);
  off = n0b;
  let selectedTermId: string | null = null;
  if (termIdLen > 0) {
    let s = '';
    for (let i = 0; i < termIdLen; i++) s += String.fromCharCode(view.getUint8(off + i));
    selectedTermId = s;
  }
  off += termIdLen;

  const { value: firstYearRaw, next: n0c } = readU16(view, off);
  off = n0c;
  const firstYear: number | null = firstYearRaw === 0 ? null : firstYearRaw;

  const { value: programIndex, next: n1 } = readU16(view, off);
  off = n1;

  const { value: minorProgramIndex, next: n1m } = readU16(view, off);
  off = n1m;

  let program: Program | null = null;
  if (programIndex !== MAX_U16 && programIndex < indices.programs.length) {
    const slug = indices.programs[programIndex];
    program = catalogue.programs.find((p) => programSlug(p) === slug) ?? null;
    if (program === null)
      return { error: 'Program from shared state is no longer in the catalogue' };
  }

  let minorProgram: Program | null = null;
  if (minorProgramIndex !== MAX_U16 && minorProgramIndex < indices.programs.length) {
    const slug = indices.programs[minorProgramIndex];
    minorProgram = catalogue.programs.find((p) => programSlug(p) === slug) ?? null;
    if (minorProgram === null)
      return { error: 'Minor program from shared state is no longer in the catalogue' };
  }

  const { value: completedLen, next: n2 } = readU16(view, off);
  off = n2;
  const completedCourseCodes: string[] = [];
  const completedOptCounters = new Map<number, number>();
  for (let i = 0; i < completedLen; i++) {
    const { value: idx, next: n } = readU16(view, off);
    off = n;
    if (idx > OPT_SENTINEL_BASE) {
      const level = (idx - OPT_SENTINEL_BASE) * 1000;
      const count = completedOptCounters.get(level) ?? 0;
      completedOptCounters.set(level, count + 1);
      completedCourseCodes.push(`OPT ${level + count}`);
    } else {
      if (idx >= indices.courses.length)
        return { error: 'A course from shared state is no longer in the catalogue' };
      completedCourseCodes.push(indices.courses[idx]);
    }
  }

  const { value: levelLen, next: n3 } = readU8(view, off);
  off = n3;
  const levelBuckets: CourseLevelBucket[] = [];
  for (let i = 0; i < levelLen; i++) {
    const { value: b, next: n } = readU8(view, off);
    off = n;
    levelBuckets.push(byteToLevel(b));
  }

  const { value: langLen, next: n4 } = readU8(view, off);
  off = n4;
  const languageBuckets: CourseLanguageBucket[] = [];
  for (let i = 0; i < langLen; i++) {
    const { value: b, next: n } = readU8(view, off);
    off = n;
    languageBuckets.push(byteToLang(b));
  }

  const { value: electiveLen, next: n5 } = readU8(view, off);
  off = n5;
  const electiveLevelBuckets: number[] = [];
  for (let i = 0; i < electiveLen; i++) {
    const { value: v, next: n } = readU16(view, off);
    off = n;
    electiveLevelBuckets.push(v);
  }

  const { value: coursesThisSemester, next: n6 } = readU8(view, off);
  off = n6;
  const { value: selectedScheduleIndex, next: n7 } = readU16(view, off);
  off = n7;

  const { value: seed, next: nSeed } = readU32(view, off);
  off = nSeed;
  const generationSeed = seed >>> 0;

  const { value: incClosed, next: nInc } = readU8(view, off);
  off = nInc;
  const includeClosedComponents = incClosed !== 0;

  const { value: virt, next: nVirt } = readU8(view, off);
  off = nVirt;
  const virtualSectionsOnly = virt !== 0;

  const { value: optCount, next: n8 } = readU16(view, off);
  off = n8;
  const optionSelections: Array<{ reqIndex: number; optionIndex: number }> = [];
  for (let i = 0; i < optCount; i++) {
    const { value: reqIndex, next: na } = readU16(view, off);
    off = na;
    const { value: optionIndex, next: nb } = readU16(view, off);
    off = nb;
    optionSelections.push({ reqIndex, optionIndex });
  }

  const { value: courseSelCount, next: n9 } = readU16(view, off);
  off = n9;
  const courseSelections: Array<{ reqIndex: number; courseCodes: string[] }> = [];
  const selectionOptCounters = new Map<number, number>();
  for (let i = 0; i < courseSelCount; i++) {
    const { value: reqIndex, next: nc } = readU16(view, off);
    off = nc;
    const { value: numCourses, next: nd } = readU16(view, off);
    off = nd;
    const courseCodes: string[] = [];
    for (let j = 0; j < numCourses; j++) {
      const { value: idx, next: ne } = readU16(view, off);
      off = ne;
      if (idx > OPT_SENTINEL_BASE) {
        const level = (idx - OPT_SENTINEL_BASE) * 1000;
        const count = selectionOptCounters.get(level) ?? 0;
        selectionOptCounters.set(level, count + 1);
        courseCodes.push(`OPT ${level + count}`);
      } else if (idx < indices.courses.length) {
        const code = indices.courses[idx];
        if (catalogue.courses.some((c) => c.code === code)) courseCodes.push(code);
      }
    }
    courseSelections.push({ reqIndex, courseCodes });
  }

  const studentPrograms: string[] = [];
  const { value: progCount, next: nPc } = readU8(view, off);
  off = nPc;
  for (let i = 0; i < progCount; i++) {
    const { value: code, next: nSt } = readString(view, off, 255);
    off = nSt;
    if (code) studentPrograms.push(code);
  }

  const constrainedSelections: Array<{ reqIndex: number; courseCodes: string[] }> = [];
  const { value: constrainedCount, next: nCs } = readU16(view, off);
  off = nCs;
  const constrainedOptCounters = new Map<number, number>();
  for (let i = 0; i < constrainedCount; i++) {
    const { value: reqIndex, next: nCr } = readU16(view, off);
    off = nCr;
    const { value: numCourses, next: nCn } = readU16(view, off);
    off = nCn;
    const courseCodes: string[] = [];
    for (let j = 0; j < numCourses; j++) {
      const { value: idx, next: nCe } = readU16(view, off);
      off = nCe;
      if (idx > OPT_SENTINEL_BASE) {
        const level = (idx - OPT_SENTINEL_BASE) * 1000;
        const count = constrainedOptCounters.get(level) ?? 0;
        constrainedOptCounters.set(level, count + 1);
        courseCodes.push(`OPT ${level + count}`);
      } else if (idx < indices.courses.length) {
        const code = indices.courses[idx];
        if (catalogue.courses.some((c) => c.code === code)) courseCodes.push(code);
      }
    }
    constrainedSelections.push({ reqIndex, courseCodes });
  }

  const { value: wizByte, next: nWiz } = readU8(view, off);
  off = nWiz;
  const wizardMode = wizByte === 1 ? "basic" : wizByte === 2 ? "advanced" : null;

  const basicPinnedCourses: string[] = [];
  const { value: bpcLen, next: nBpcL } = readU16(view, off);
  off = nBpcL;
  for (let i = 0; i < bpcLen; i++) {
    const { value: idx, next: nBpc } = readU16(view, off);
    off = nBpc;
    if (idx < indices.courses.length) basicPinnedCourses.push(indices.courses[idx]);
  }

  const { value: basicElectivesCount, next: nBec } = readU8(view, off);
  off = nBec;

  const basicExcludedCategories: string[] = [];
  const { value: excLen, next: nExcL } = readU16(view, off);
  off = nExcL;
  for (let i = 0; i < excLen; i++) {
    const { value: cat, next: nExc } = readString(view, off, 255);
    off = nExc;
    basicExcludedCategories.push(cat);
  }

  const touchedReqIndices: number[] = [];
  const { value: tLen, next: nTLen } = readU16(view, off);
  off = nTLen;
  for (let i = 0; i < tLen; i++) {
    const { value: idx, next: nIdx } = readU16(view, off);
    off = nIdx;
    touchedReqIndices.push(idx);
  }

  const { value: generationMinStartMinutes, next: nGMs } = readU16(view, off);
  off = nGMs;

  const { value: generationMaxEndMinutes, next: nGMe } = readU16(view, off);
  off = nGMe;

  const { value: daysBitmask, next: nDays } = readU8(view, off);
  off = nDays;
  const generationAllowedDays = bitToDays(daysBitmask);

  const { value: ratingU8, next: nRat } = readU8(view, off);
  off = nRat;
  const generationMinProfessorRating = ratingU8 === 255 ? null : ratingU8 / 10;

  const { value: genLimitFc, next: nGfc } = readU8(view, off);
  off = nGfc;
  const generationLimitFirstYearCredits = genLimitFc !== 0;

  const { value: genComp, next: nGcm } = readU8(view, off);
  off = nGcm;
  const generationCompressedSchedule = genComp !== 0;

  return {
    wizardMode,
    basicPinnedCourses,
    basicElectivesCount,
    basicExcludedCategories,
    selectedTermId,
    firstYear,
    program,
    minorProgram,
    completedCourseCodes,
    levelBuckets,
    languageBuckets,
    electiveLevelBuckets,
    coursesThisSemester,
    selectedScheduleIndex,
    generationSeed,
    optionSelections,
    courseSelections,
    constrainedSelections,
    includeClosedComponents,
    virtualSectionsOnly,
    studentPrograms,
    touchedReqIndices,
    generationMinStartMinutes,
    generationMaxEndMinutes,
    generationAllowedDays,
    generationMinProfessorRating,
    generationLimitFirstYearCredits,
    generationCompressedSchedule,
  };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array | null {
  try {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

export function stateToShareUrl(
  encoded: Uint8Array,
  baseUrl: string = typeof window !== 'undefined'
    ? `${window.location.origin}${window.location.pathname}`
    : ''
): string {
  const q = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${q}s=${encodeURIComponent(bytesToBase64(encoded))}`;
}

export function parseStateFromUrl(search: string): Uint8Array | null {
  const params = new URLSearchParams(search);
  const s = params.get('s');
  if (!s) return null;
  try {
    return base64ToBytes(decodeURIComponent(s));
  } catch {
    return null;
  }
}

export function encodeStateToBase64(
  input: EncodeInput,
  catalogue: CatalogueLike,
  indices: Indices
): string | null {
  const bytes = encodeState(input, catalogue, indices);
  if (!bytes) return null;
  return bytesToBase64(bytes);
}

export function decodeStateFromBase64(
  base64: string,
  catalogue: CatalogueLike,
  indices: Indices
): DecodedState | DecodeError {
  const bytes = base64ToBytes(base64);
  if (!bytes) return { error: 'Invalid state encoding' };
  return decodeState(bytes, catalogue, indices);
}

export function peekTermAndYearFromBase64(
  base64: string
): { termId: string | null; firstYear: number | null } | null {
  const bytes = base64ToBytes(base64);
  if (!bytes) return null;
  return peekTermAndYear(bytes);
}
