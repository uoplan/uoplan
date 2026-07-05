import { describe, expect, it } from "vitest";
import * as DataProto from "@uoplan/proto/data";
import { DescriptionSearchIndex, tokenizeDescription } from "../search/descriptionSearch";

/** Front-code a sorted term list exactly as the scraper builder does. */
function encodeTermDictionary(sortedTerms: readonly string[]): Uint8Array {
  const out: number[] = [];
  const encoder = new TextEncoder();
  const pushVarint = (value: number): void => {
    let v = value;
    while (v > 0x7f) {
      out.push((v & 0x7f) | 0x80);
      v = Math.floor(v / 128);
    }
    out.push(v);
  };
  let previous = "";
  for (const term of sortedTerms) {
    let prefixLength = 0;
    const max = Math.min(previous.length, term.length);
    while (prefixLength < max && previous[prefixLength] === term[prefixLength]) prefixLength += 1;
    const suffix = encoder.encode(term.slice(prefixLength));
    pushVarint(prefixLength);
    pushVarint(suffix.length);
    for (const b of suffix) out.push(b);
    previous = term;
  }
  return Uint8Array.from(out);
}

interface FixtureCourse {
  code: string;
  docLength: number;
}

/**
 * Build a {@link DataProto.CourseSearchIndex} from an explicit term → postings
 * map so reader behavior can be asserted deterministically.
 */
function buildFixture(
  courses: FixtureCourse[],
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
    docLengths: courses.map((c) => c.docLength),
    termDictionary: encodeTermDictionary(sortedTerms),
    termDfs,
    postingCourseDeltas,
    postingFreqs,
  };
  const bytes = DataProto.CourseSearchIndex.encode(proto).finish();
  return DescriptionSearchIndex.fromBytes(bytes);
}

describe("tokenizeDescription", () => {
  it("folds accents, lowercases, and drops short tokens", () => {
    expect(tokenizeDescription("Théorie de l'Algèbre")).toEqual(["theorie", "algebre"]);
  });

  it("drops bilingual stopwords", () => {
    expect(tokenizeDescription("the study of les données avec that")).toEqual(["study", "donnee"]);
  });

  it("stems a trailing plural s on longer tokens only", () => {
    expect(tokenizeDescription("courses class")).toEqual(["course", "class"]);
    // Short words and `ss` endings are left unstemmed.
    expect(tokenizeDescription("bus glass")).toEqual(["bus", "glass"]);
  });
});

describe("DescriptionSearchIndex", () => {
  // AAA: quantum×2, algebra×1  BBB: quantum×1  CCC: quantify×1, algebra×2
  const index = buildFixture(
    [
      { code: "AAA 1000", docLength: 3 },
      { code: "BBB 2000", docLength: 1 },
      { code: "CCC 3000", docLength: 3 },
    ],
    {
      algebra: [
        [0, 1],
        [2, 2],
      ],
      quantify: [[2, 1]],
      quantum: [
        [0, 2],
        [1, 1],
      ],
    },
  );

  const codes = (query: string): string[] => index.search(query).map((m) => m.code);

  it("reports the covered course count", () => {
    expect(index.size).toBe(3);
  });

  it("matches an exact keyword and excludes courses without it", () => {
    const hits = codes("quantum");
    expect(hits).toContain("AAA 1000");
    expect(hits).toContain("BBB 2000");
    expect(hits).not.toContain("CCC 3000");
  });

  it("ranks a course matching every query term above single-term matches", () => {
    expect(codes("quantum algebra")[0]).toBe("AAA 1000");
  });

  it("matches by prefix (search-as-you-type)", () => {
    // "quantif" is a prefix of "quantify" only → the course carrying it.
    expect(codes("quantif")).toEqual(["CCC 3000"]);
  });

  it("tolerates a single-edit typo via bounded fuzzy matching", () => {
    // "quantm" is edit distance 1 from "quantum" (dropped a 'u').
    const hits = codes("quantm");
    expect(hits).toContain("AAA 1000");
    expect(hits).toContain("BBB 2000");
  });

  it("returns nothing for an unknown token", () => {
    expect(codes("zzzztop")).toEqual([]);
    expect(codes("")).toEqual([]);
  });
});

describe("DescriptionSearchIndex coordination factor", () => {
  it("penalizes a course that covers only part of a multi-term query", () => {
    // ZZZ carries only "aaa"; WWW carries only "bbb". Both are single-posting terms
    // with identical document lengths, so ZZZ's "aaa" contribution is fixed.
    const index = buildFixture(
      [
        { code: "ZZZ 1000", docLength: 1 },
        { code: "WWW 2000", docLength: 1 },
      ],
      {
        aaa: [[0, 1]],
        bbb: [[1, 1]],
      },
    );
    const single = index.search("aaa").find((m) => m.code === "ZZZ 1000")?.score ?? 0;
    const partial = index.search("aaa bbb").find((m) => m.code === "ZZZ 1000")?.score ?? 0;
    // Adding a second matchable query term ZZZ doesn't cover scales its score by
    // the coordination factor 0.3 + 0.7 * (1/2) = 0.65 versus the single-term query.
    expect(single).toBeGreaterThan(0);
    expect(partial).toBeCloseTo(single * 0.65, 5);
  });
});
