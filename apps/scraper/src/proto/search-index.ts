import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import { tokenizeDescription } from "@uoplan/core/search/descriptionSearch";
import type * as DataProto from "@uoplan/proto/data";

/**
 * Build a compact {@link DataProto.CourseSearchIndex} from course descriptions.
 * Tokenizes each description, keeps every term whose **document frequency** falls
 * in the `[minDf, maxDf]` band, then emits a sorted front-coded keyword dictionary
 * + delta-encoded postings. Raw description text is never included — only the
 * (folded/stemmed) keyword tokens and per-course term frequencies, enough for BM25
 * scoring with exact/prefix/fuzzy matching. See docs/explore-search.md.
 *
 * The df band replaces an earlier per-course top-K TF-IDF cap, which kept only the
 * few *rarest* terms per course and so dropped meaningful mid-frequency words
 * (e.g. "logic", df=29) — the cause of missing results like MAT 2362 for
 * "propositional logic". Dropping hapax terms (df=1, ~35% of the vocabulary) and
 * capping near-stopwords (df > maxDf, already served by the primary code/title
 * search) keeps the discriminative middle band, fixing recall while shrinking the
 * shipped asset.
 */

export interface CourseDescriptionInput {
  code: string;
  title: string;
  description: string;
}

export interface SearchIndexOptions {
  /**
   * Drop rare/hapax terms with document frequency below this. Removing single-
   * occurrence terms (df=1) shrinks the dictionary for a negligible recall cost.
   */
  minDf?: number;
  /**
   * Drop near-stopword terms with document frequency above this. A term appearing
   * in more course descriptions than this is too common to discriminate — such
   * words are already handled by the primary code/title search.
   */
  maxDf?: number;
}

const DEFAULT_MIN_DF = 2;
const DEFAULT_MAX_DF = 200;
const MAX_FREQ = 255;

interface CourseTokens {
  code: string;
  freqs: Map<string, number>;
}

/** Append a base-128 varint encoding of `value` to `out`. */
function pushVarint(out: number[], value: number): void {
  let v = value;
  while (v > 0x7f) {
    out.push((v & 0x7f) | 0x80);
    v = Math.floor(v / 128);
  }
  out.push(v);
}

/**
 * Front-code a sorted term list into a single byte blob. Each entry is
 * `varint(prefixLen) + varint(suffixLen) + suffix bytes`, where `prefixLen` is
 * the number of leading bytes shared with the previous term.
 */
function encodeTermDictionary(sortedTerms: readonly string[]): Uint8Array {
  const out: number[] = [];
  const encoder = new TextEncoder();
  let previous = "";
  for (const term of sortedTerms) {
    let prefixLength = 0;
    const maxPrefix = Math.min(previous.length, term.length);
    while (prefixLength < maxPrefix && previous[prefixLength] === term[prefixLength]) {
      prefixLength += 1;
    }
    const suffix = encoder.encode(term.slice(prefixLength));
    pushVarint(out, prefixLength);
    pushVarint(out, suffix.length);
    for (const byte of suffix) out.push(byte);
    previous = term;
  }
  return Uint8Array.from(out);
}

export function buildCourseSearchIndex(
  input: readonly CourseDescriptionInput[],
  options: SearchIndexOptions = {},
): DataProto.CourseSearchIndex {
  const minDf = options.minDf ?? DEFAULT_MIN_DF;
  const maxDf = options.maxDf ?? DEFAULT_MAX_DF;

  // Pass 1: tokenize descriptions and accumulate document frequency per term.
  const perCourse: CourseTokens[] = [];
  const documentFrequency = new Map<string, number>();
  for (const { code, title, description } of input) {
    const text = description.trim();
    if (text.length === 0 || text === title.trim()) continue;
    const freqs = new Map<string, number>();
    for (const token of tokenizeDescription(text)) {
      freqs.set(token, (freqs.get(token) ?? 0) + 1);
    }
    if (freqs.size === 0) continue;
    perCourse.push({ code, freqs });
    for (const term of freqs.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) ?? 0) + 1);
    }
  }

  // Sort covered courses by normalized code so the emitted `course_codes` array
  // is prefix-sorted (far better gzip) and the index is deterministic.
  perCourse.sort((a, b) => (normalizeCourseCode(a.code) < normalizeCourseCode(b.code) ? -1 : 1));

  // Pass 2: keep every term whose document frequency is in the [minDf, maxDf]
  // band; record per-course kept terms + document lengths.
  const courseCodes: string[] = [];
  const docLengths: number[] = [];
  const keptPerCourse: { term: string; freq: number }[][] = [];
  const vocabulary = new Set<string>();

  for (const course of perCourse) {
    courseCodes.push(normalizeCourseCode(course.code));
    let docLength = 0;
    const kept: { term: string; freq: number }[] = [];
    for (const [term, tf] of course.freqs) {
      const df = documentFrequency.get(term) ?? 1;
      if (df < minDf || df > maxDf) continue;
      const clamped = Math.min(tf, MAX_FREQ);
      kept.push({ term, freq: clamped });
      docLength += clamped;
      vocabulary.add(term);
    }
    keptPerCourse.push(kept);
    docLengths.push(docLength);
  }

  // Assign term ids by sorted dictionary order.
  const sortedTerms = [...vocabulary].sort();
  const termToId = new Map<string, number>();
  for (let id = 0; id < sortedTerms.length; id += 1) termToId.set(sortedTerms[id], id);

  // Invert kept terms into per-term postings.
  const termPostings: Map<number, number>[] = sortedTerms.map(() => new Map());
  for (let courseIndex = 0; courseIndex < keptPerCourse.length; courseIndex += 1) {
    for (const { term, freq } of keptPerCourse[courseIndex]) {
      termPostings[termToId.get(term)!].set(courseIndex, freq);
    }
  }

  // Flatten postings into packed parallel arrays (avoids per-term message
  // framing). Course indices are delta-encoded within each term.
  const termDfs: number[] = [];
  const postingCourseDeltas: number[] = [];
  const postingFreqs: number[] = [];
  for (const courseFreqs of termPostings) {
    const courseIndices = [...courseFreqs.keys()].sort((a, b) => a - b);
    termDfs.push(courseIndices.length);
    let previousCourse = 0;
    for (const courseIndex of courseIndices) {
      postingCourseDeltas.push(courseIndex - previousCourse);
      previousCourse = courseIndex;
      postingFreqs.push(courseFreqs.get(courseIndex)!);
    }
  }

  return {
    courseCodes,
    docLengths,
    termDictionary: encodeTermDictionary(sortedTerms),
    termDfs,
    postingCourseDeltas,
    postingFreqs,
  };
}
