import * as DataProto from "@uoplan/proto/data";

/**
 * Course-code string used by the description index. Compatible with
 * `@uoplan/core`'s `NormalizedCourseCode` at call sites (both are nominal
 * string brands used as opaque codes).
 */
export type NormalizedCourseCode = string;

/**
 * Shared course-description keyword search: a compact, BM25-scored secondary
 * signal for explore search that never ships the raw description text. The
 * scraper builds a {@link DataProto.CourseSearchIndex} (a front-coded keyword
 * dictionary + per-course term frequencies); both the web and native apps decode
 * it and run {@link DescriptionSearchIndex.search} at query time. The tokenizer
 * here is the single source of truth, so build-time postings and query-time
 * lookups always agree. The dictionary is shipped in full (not hashed), so
 * queries can match terms exactly, by prefix (search-as-you-type), and by bounded
 * edit distance (typo tolerance).
 */

const COMBINING_MARKS = /[\u0300-\u036f]/g;
const TOKEN_PATTERN = /[a-z0-9]+/g;

// Bilingual (EN + FR) stopwords. Kept deliberately small: high-frequency
// function words that add no discriminative value to a description search.
const STOPWORDS: ReadonlySet<string> = new Set([
  // English
  "the",
  "and",
  "for",
  "are",
  "with",
  "this",
  "that",
  "from",
  "was",
  "were",
  "will",
  "have",
  "has",
  "had",
  "not",
  "but",
  "you",
  "your",
  "who",
  "all",
  "can",
  "may",
  "its",
  "their",
  "they",
  "them",
  "which",
  "such",
  "these",
  "those",
  "into",
  "than",
  "then",
  "out",
  "our",
  "one",
  "two",
  "how",
  "any",
  "use",
  "used",
  "using",
  "also",
  "each",
  "per",
  "via",
  "etc",
  "other",
  "more",
  "most",
  "some",
  "over",
  "under",
  "between",
  "within",
  "about",
  "upon",
  // French
  "les",
  "des",
  "une",
  "aux",
  "avec",
  "pour",
  "dans",
  "sur",
  "par",
  "que",
  "qui",
  "est",
  "sont",
  "cette",
  "ces",
  "leur",
  "leurs",
  "ont",
  "ainsi",
  "cet",
  "elle",
  "ils",
  "elles",
  "nous",
  "vous",
  "ses",
  "son",
  "sous",
  "entre",
  "comme",
  "plus",
  "tout",
  "tous",
  "toute",
  "toutes",
  "etre",
  "avoir",
  "aussi",
  "chaque",
  "afin",
  "selon",
  "donne",
]);

/** Strip diacritics and lowercase (matches build + query tokenization). */
function foldText(text: string): string {
  return text.normalize("NFD").replace(COMBINING_MARKS, "").toLowerCase();
}

/**
 * Light, language-agnostic stem: drop a single trailing plural `s` on longer
 * tokens (unifies e.g. "courses"→"course", "etudiants"→"etudiant") while leaving
 * short words and `ss` endings untouched. Applied identically at build + query
 * time, so exact agreement matters more than linguistic correctness.
 */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

/** Tokenize free text into keyword tokens: fold, split, drop stopwords/short, stem. */
export function tokenizeDescription(text: string): string[] {
  const out: string[] = [];
  for (const match of foldText(text).matchAll(TOKEN_PATTERN)) {
    const surface = match[0];
    if (surface.length < 3 || STOPWORDS.has(surface)) continue;
    const stemmed = stem(surface);
    if (stemmed.length < 3) continue;
    out.push(stemmed);
  }
  return out;
}

const BM25_K1 = 1.2;
const BM25_B = 0.75;

// Match-quality weights applied to a term's BM25 contribution. Exact keyword
// matches count fully; prefix and fuzzy expansions of a query token count less so
// description hits stay a clearly secondary signal.
const EXACT_WEIGHT = 1;
const PREFIX_WEIGHT = 0.6;
const FUZZY_WEIGHT = 0.45;

// Coordination floor: a course's raw BM25 sum is scaled by
// `COORD_BASE + (1 - COORD_BASE) * (matchedQueryTerms / matchableQueryTerms)`, so a
// course covering more of the query's distinct terms is rewarded. This lifts a course
// matching every query word (e.g. MAT 2362 for "propositional logic") above one matching
// only a single, more common word whose BM25 happens to be higher after length
// normalization. Single-term queries are unaffected (coverage is always 1).
const COORD_BASE = 0.3;

// Bounds so a short/common query token can't explode into thousands of postings.
const MIN_FUZZY_LENGTH = 4;
const MAX_PREFIX_EXPANSIONS = 32;
const MAX_FUZZY_EXPANSIONS = 24;

export interface DescriptionMatch {
  code: NormalizedCourseCode;
  score: number;
}

interface TermPostings {
  courses: number[];
  freqs: number[];
}

/** Read a base-128 varint from `bytes` starting at `offset`; returns value + next offset. */
function readVarint(bytes: Uint8Array, offset: number): [number, number] {
  let result = 0;
  let shift = 0;
  let pos = offset;
  for (;;) {
    const byte = bytes[pos];
    pos += 1;
    result += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return [result, pos];
}

/** Decode the front-coded term dictionary into the sorted term array. */
function decodeTermDictionary(bytes: Uint8Array, count: number): string[] {
  const decoder = new TextDecoder();
  const terms: string[] = [];
  let offset = 0;
  let previous = "";
  for (let i = 0; i < count; i += 1) {
    let prefixLength: number;
    let suffixLength: number;
    [prefixLength, offset] = readVarint(bytes, offset);
    [suffixLength, offset] = readVarint(bytes, offset);
    const suffix = decoder.decode(bytes.subarray(offset, offset + suffixLength));
    offset += suffixLength;
    const term = previous.slice(0, prefixLength) + suffix;
    terms.push(term);
    previous = term;
  }
  return terms;
}

/** Lowest index `i` with `terms[i] >= target` (binary search over sorted terms). */
function lowerBound(terms: string[], target: string): number {
  let lo = 0;
  let hi = terms.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (terms[mid] < target) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** True if the edit (Levenshtein) distance between `a` and `b` is at most 1. */
function withinEditDistance1(a: string, b: string): boolean {
  const la = a.length;
  const lb = b.length;
  if (la === lb) {
    let mismatches = 0;
    for (let i = 0; i < la; i += 1) {
      if (a[i] !== b[i]) {
        mismatches += 1;
        if (mismatches > 1) return false;
      }
    }
    return true;
  }
  // Ensure `a` is the shorter string; lengths differ by exactly 1 (single indel).
  const short = la < lb ? a : b;
  const long = la < lb ? b : a;
  if (long.length - short.length !== 1) return false;
  let i = 0;
  let j = 0;
  let edited = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i += 1;
      j += 1;
    } else {
      if (edited) return false;
      edited = true;
      j += 1; // skip the extra character in `long`
    }
  }
  return true;
}

/**
 * Query-time reader over a {@link DataProto.CourseSearchIndex}. Decodes the
 * front-coded dictionary + delta-encoded postings once, then answers BM25
 * keyword queries with exact, prefix, and bounded-fuzzy term matching.
 */
export class DescriptionSearchIndex {
  private readonly codes: NormalizedCourseCode[];
  private readonly docLengths: number[];
  private readonly terms: string[];
  private readonly postings: TermPostings[];
  private readonly docCount: number;
  private readonly avgDocLength: number;

  private constructor(proto: DataProto.CourseSearchIndex) {
    this.codes = proto.courseCodes as NormalizedCourseCode[];
    this.docLengths = proto.docLengths;
    this.terms = decodeTermDictionary(proto.termDictionary, proto.termDfs.length);

    // Walk the flattened postings, slicing `term_dfs[t]` entries per term and
    // undoing the per-term delta encoding.
    this.postings = [];
    let cursor = 0;
    for (let t = 0; t < proto.termDfs.length; t += 1) {
      const df = proto.termDfs[t];
      const courses: number[] = [];
      const freqs: number[] = [];
      let course = 0;
      for (let k = 0; k < df; k += 1) {
        course += proto.postingCourseDeltas[cursor];
        courses.push(course);
        freqs.push(proto.postingFreqs[cursor]);
        cursor += 1;
      }
      this.postings.push({ courses, freqs });
    }

    this.docCount = this.codes.length;
    let total = 0;
    for (const length of this.docLengths) total += length;
    this.avgDocLength = this.docCount > 0 ? total / this.docCount : 0;
  }

  static fromProto(proto: DataProto.CourseSearchIndex): DescriptionSearchIndex {
    return new DescriptionSearchIndex(proto);
  }

  static fromBytes(bytes: Uint8Array): DescriptionSearchIndex {
    return new DescriptionSearchIndex(DataProto.CourseSearchIndex.decode(bytes));
  }

  /** Number of courses covered by the index. */
  get size(): number {
    return this.docCount;
  }

  /**
   * Collect the dictionary terms a query token matches, each with a match-quality
   * weight (exact > prefix > fuzzy). A term qualifying under several strategies
   * keeps its highest weight.
   */
  private collectCandidates(token: string): Map<number, number> {
    const candidates = new Map<number, number>();
    const start = lowerBound(this.terms, token);

    // Exact match sits at `start` (if present).
    if (start < this.terms.length && this.terms[start] === token) {
      candidates.set(start, EXACT_WEIGHT);
    }

    // Prefix expansions ("quant" → "quantum"): the contiguous run of terms that
    // start with the token, immediately after the lower bound.
    let prefixCount = 0;
    for (let i = start; i < this.terms.length && prefixCount < MAX_PREFIX_EXPANSIONS; i += 1) {
      const term = this.terms[i];
      if (!term.startsWith(token)) break;
      if (term !== token && (candidates.get(i) ?? 0) < PREFIX_WEIGHT) {
        candidates.set(i, PREFIX_WEIGHT);
      }
      prefixCount += 1;
    }

    // Fuzzy expansions (edit distance ≤ 1) over the same first-character band,
    // catching mid/end-of-word typos without a full-dictionary scan.
    if (token.length >= MIN_FUZZY_LENGTH) {
      let fuzzyCount = 0;
      const bandStart = lowerBound(this.terms, token[0]);
      for (let i = bandStart; i < this.terms.length && fuzzyCount < MAX_FUZZY_EXPANSIONS; i += 1) {
        const term = this.terms[i];
        if (term[0] !== token[0]) break;
        if (Math.abs(term.length - token.length) > 1) continue;
        if (!withinEditDistance1(term, token)) continue;
        if ((candidates.get(i) ?? 0) < FUZZY_WEIGHT) candidates.set(i, FUZZY_WEIGHT);
        fuzzyCount += 1;
      }
    }

    return candidates;
  }

  /**
   * BM25-score the query against course descriptions. Returns matches sorted by
   * descending score. Only courses whose description matches a query keyword
   * appear; callers rank these below exact code/title matches.
   */
  search(query: string): DescriptionMatch[] {
    if (this.docCount === 0 || this.avgDocLength === 0) return [];
    const tokens = new Set(tokenizeDescription(query));
    if (tokens.size === 0) return [];

    const scores = new Map<number, number>();
    const matchedTermCounts = new Map<number, number>();
    let matchableTermCount = 0;
    for (const token of tokens) {
      const candidates = this.collectCandidates(token);
      if (candidates.size === 0) continue;
      matchableTermCount += 1;

      // Best contribution this query token makes to each course, so a single word
      // expanding into many dictionary terms can't multiply one course's score.
      const tokenScores = new Map<number, number>();
      for (const [termId, weight] of candidates) {
        const { courses, freqs } = this.postings[termId];
        const df = courses.length;
        const idf = Math.log(1 + (this.docCount - df + 0.5) / (df + 0.5));
        for (let j = 0; j < courses.length; j += 1) {
          const courseIndex = courses[j];
          const tf = freqs[j];
          const dl = this.docLengths[courseIndex];
          const denominator = tf + BM25_K1 * (1 - BM25_B + (BM25_B * dl) / this.avgDocLength);
          const contribution = weight * idf * ((tf * (BM25_K1 + 1)) / denominator);
          const previous = tokenScores.get(courseIndex);
          if (previous === undefined || contribution > previous) {
            tokenScores.set(courseIndex, contribution);
          }
        }
      }

      for (const [courseIndex, contribution] of tokenScores) {
        scores.set(courseIndex, (scores.get(courseIndex) ?? 0) + contribution);
        matchedTermCounts.set(courseIndex, (matchedTermCounts.get(courseIndex) ?? 0) + 1);
      }
    }

    const matches: DescriptionMatch[] = [];
    for (const [courseIndex, rawScore] of scores) {
      const coverage =
        matchableTermCount > 0 ? (matchedTermCounts.get(courseIndex) ?? 0) / matchableTermCount : 1;
      const coord = COORD_BASE + (1 - COORD_BASE) * coverage;
      matches.push({ code: this.codes[courseIndex], score: rawScore * coord });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches;
  }
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
 * the number of leading bytes shared with the previous term. Shared by the
 * scraper builder and unit-test fixtures so both emit the same on-disk shape.
 */
export function encodeTermDictionary(sortedTerms: readonly string[]): Uint8Array {
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

export interface DescriptionSearchFixtureCourse {
  code: string;
  /** Defaults to 1 when omitted (typical for explore search tests). */
  docLength?: number;
}

/**
 * Build a {@link DescriptionSearchIndex} from an explicit term → postings map
 * so reader behavior can be asserted deterministically in tests.
 */
export function buildDescriptionSearchIndexFixture(
  courses: readonly DescriptionSearchFixtureCourse[],
  postingsByTerm: Record<string, [courseIndex: number, freq: number][]>,
): DescriptionSearchIndex {
  const sortedTerms = Object.keys(postingsByTerm).sort();
  const termDfs: number[] = [];
  const postingCourseDeltas: number[] = [];
  const postingFreqs: number[] = [];
  for (const term of sortedTerms) {
    const postings = [...postingsByTerm[term]].sort((a, b) => a[0] - b[0]);
    termDfs.push(postings.length);
    let previous = 0;
    for (const [courseIndex, freq] of postings) {
      postingCourseDeltas.push(courseIndex - previous);
      previous = courseIndex;
      postingFreqs.push(freq);
    }
  }
  const proto: DataProto.CourseSearchIndex = {
    courseCodes: courses.map((c) => c.code),
    docLengths: courses.map((c) => c.docLength ?? 1),
    termDictionary: encodeTermDictionary(sortedTerms),
    termDfs,
    postingCourseDeltas,
    postingFreqs,
  };
  return DescriptionSearchIndex.fromProto(proto);
}
