import { describe, expect, it } from "vitest";

import oracle from "./__fixtures__/prereqOracle.json" with { type: "json" };
import type { CoursePrereqNode } from "./schema.ts";
import { classifyNonCourse, parseCoursePrerequisites } from "./prerequisites.ts";
import { canonicalizeDisciplineLevels } from "./regressionTestHelpers.ts";

/**
 * Frozen-corpus regression guard for the prerequisite parser.
 *
 * `prereqOracle.json` is a snapshot of the OLD parser's output over every
 * distinct prerequisite sentence in the committed catalogue (4,548 unique texts,
 * 47k+ occurrences). It is intentionally frozen — it is NOT regenerated when the
 * catalogue is re-scraped — so the new parser can be proven additive: it may
 * capture MORE structure (e.g. `kind` annotations) but must never DROP a course
 * code the old parser found.
 */

type OracleEntry = { prereqText: string; count: number; oldAst: CoursePrereqNode | null };
const corpus = oracle as OracleEntry[];

function normCode(code: string | undefined): string | undefined {
  return code ? code.replaceAll(/\s+/g, " ").trim().toUpperCase() : code;
}

/** Collect every course code anywhere in an AST. */
function codesOf(node: CoursePrereqNode | null | undefined): Set<string> {
  const out = new Set<string>();
  const walk = (n: CoursePrereqNode | null | undefined): void => {
    if (!n) return;
    if (n.code) out.add(normCode(n.code) as string);
    for (const c of n.children ?? []) walk(c);
  };
  walk(node);
  return out;
}

/**
 * Canonicalize an AST for structural comparison: normalize codes, sort the
 * children of commutative groups, drop the volatile `text` field and the
 * additive `kind` annotation (so improvements register as "identical").
 */
function canonicalize(node: CoursePrereqNode | null | undefined): unknown {
  if (node == null) return null;
  const out: Record<string, unknown> = { type: node.type };
  if (node.code) out.code = normCode(node.code);
  if (node.credits != null) out.credits = node.credits;
  if (node.disciplines?.length) out.disciplines = [...node.disciplines].sort();
  if (node.levels?.length) out.levels = [...node.levels].sort((a, b) => a - b);
  const disciplineLevels = canonicalizeDisciplineLevels(node.disciplineLevels);
  if (disciplineLevels) out.disciplineLevels = disciplineLevels;
  if (node.programs?.length) out.programs = [...node.programs].sort();
  if (node.children?.length) {
    const kids = node.children.map(canonicalize);
    if (node.type === "or_group" || node.type === "and_group")
      kids.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    out.children = kids;
  }
  return out;
}

describe("prerequisite parser regression (frozen corpus)", () => {
  it("never drops a course code the old parser captured", () => {
    const regressions: Array<{ text: string; dropped: string[] }> = [];
    for (const entry of corpus) {
      const next = parseCoursePrerequisites(entry.prereqText) ?? null;
      const oldCodes = codesOf(entry.oldAst);
      const newCodes = codesOf(next);
      const dropped = [...oldCodes].filter((c) => !newCodes.has(c));
      if (dropped.length > 0) regressions.push({ text: entry.prereqText, dropped });
    }
    expect(regressions).toEqual([]);
  });

  it("produces output structurally identical to the frozen oracle", () => {
    const changed: Array<{ text: string }> = [];
    for (const entry of corpus) {
      const next = parseCoursePrerequisites(entry.prereqText) ?? null;
      if (JSON.stringify(canonicalize(entry.oldAst)) !== JSON.stringify(canonicalize(next))) {
        changed.push({ text: entry.prereqText });
      }
    }
    expect(changed).toEqual([]);
  });

  it("classifies the majority of opaque non_course requirements", () => {
    let opaque = 0;
    let classified = 0;
    const walk = (n: CoursePrereqNode | null | undefined, weight: number): void => {
      if (!n) return;
      if (
        n.type === "non_course" &&
        n.credits == null &&
        !n.disciplines?.length &&
        !n.disciplineLevels?.length
      ) {
        opaque += weight;
        if (n.kind) classified += weight;
      }
      for (const c of n.children ?? []) walk(c, weight);
    };
    for (const entry of corpus) walk(parseCoursePrerequisites(entry.prereqText), entry.count);
    expect(opaque).toBeGreaterThan(0);
    // Prototype measured 87.5% coverage; guard against accidental regressions.
    expect(classified / opaque).toBeGreaterThan(0.8);
  });
});

describe("classifyNonCourse", () => {
  it.each([
    ["Permission of the Department", "permission"],
    ["Permission du Département", "permission"],
    ["Audition required", "audition"],
    ["Passive knowledge of French", "language"],
    ["MCV4U", "highschool"],
    ["Advanced Functions (MHF4U)", "highschool"],
    ["A minimum CGPA of 7.0", "standing"],
    ["4th-year standing", "standing"],
    ["Topic to be determined", "topic"],
    ["Strongly recommended: a statistics course", "recommended"],
  ] as const)("classifies %j as %s", (text, kind) => {
    expect(classifyNonCourse(text)).toBe(kind);
  });

  it("returns undefined for unclassifiable text", () => {
    expect(classifyNonCourse("above")).toBeUndefined();
    expect(classifyNonCourse("")).toBeUndefined();
  });
});
