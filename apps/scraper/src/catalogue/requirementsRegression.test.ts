import { describe, expect, it } from "vitest";

import oracle from "./__fixtures__/programReqOracle.json" with { type: "json" };
import type { ProgramRequirement } from "./schema.ts";
import { parseElectiveRequirement } from "./requirements.ts";

/**
 * Frozen-corpus regression guard for the program degree-requirement parser.
 *
 * `programReqOracle.json` is a snapshot of the OLD parser's output for every
 * distinct, idempotent elective-family requirement title in the committed
 * catalogue (1,369 entries). Each node is already canonicalized with the
 * additive `levels` field dropped, so the new parser can be proven additive: it
 * may attach MORE structure (e.g. `levels` level constraints) but must never
 * change the type, drop a course code, or alter the credit value the old parser
 * produced. The fixture is intentionally frozen — it is NOT regenerated on
 * re-scrape.
 */

type OracleEntry = {
  title: string;
  credits: number | null;
  node: ProgramRequirement;
};
const corpus = oracle as OracleEntry[];

/**
 * Canonicalize a requirement for structural comparison, dropping the additive
 * `levels` field so newly-captured level constraints register as "identical".
 */
function canonicalize(node: ProgramRequirement | null | undefined): unknown {
  if (node == null || typeof node !== "object") return node;
  const out: Record<string, unknown> = { type: node.type };
  if (node.code) out.code = node.code;
  if (node.credits != null) out.credits = node.credits;
  if (node.faculty) out.faculty = node.faculty;
  if (node.excluded_disciplines?.length)
    out.excluded_disciplines = [...node.excluded_disciplines].sort();
  if (node.disciplineLevels?.length)
    out.disciplineLevels = node.disciplineLevels
      .map((d) => ({
        discipline: d.discipline,
        levels: d.levels ? [...d.levels].sort((a, b) => a - b) : undefined,
      }))
      .sort((a, b) => a.discipline.localeCompare(b.discipline));
  if (node.title) out.title = node.title;
  if (node.options?.length) out.options = node.options.map(canonicalize);
  return out;
}

/** Collect every course code anywhere in a requirement tree. */
function codesOf(node: ProgramRequirement | null | undefined): Set<string> {
  const out = new Set<string>();
  const walk = (n: ProgramRequirement | null | undefined): void => {
    if (!n) return;
    if (n.code) out.add(n.code.replace(/\s+/g, " ").trim().toUpperCase());
    for (const o of n.options ?? []) walk(o);
  };
  walk(node);
  return out;
}

describe("program requirement parser regression (frozen corpus)", () => {
  it("produces output structurally identical to the frozen oracle (levels-additive)", () => {
    const changed: Array<{ title: string }> = [];
    for (const entry of corpus) {
      const next = parseElectiveRequirement(entry.title, entry.credits ?? undefined);
      if (JSON.stringify(canonicalize(next)) !== JSON.stringify(entry.node)) {
        changed.push({ title: entry.title });
      }
    }
    expect(changed).toEqual([]);
  });

  it("never changes the requirement type or drops a course code", () => {
    const regressions: Array<{ title: string; reason: string }> = [];
    for (const entry of corpus) {
      const next = parseElectiveRequirement(entry.title, entry.credits ?? undefined);
      if (next.type !== entry.node.type) {
        regressions.push({ title: entry.title, reason: `type ${entry.node.type} -> ${next.type}` });
      }
      const oldCodes = codesOf(entry.node);
      const newCodes = codesOf(next);
      const dropped = [...oldCodes].filter((c) => !newCodes.has(c));
      if (dropped.length) {
        regressions.push({ title: entry.title, reason: `dropped ${dropped.join(",")}` });
      }
      if ((entry.node.credits ?? null) !== (next.credits ?? null)) {
        regressions.push({ title: entry.title, reason: "credits changed" });
      }
    }
    expect(regressions).toEqual([]);
  });

  it("captures level constraints on discipline-less electives", () => {
    let withLevels = 0;
    for (const entry of corpus) {
      const next = parseElectiveRequirement(entry.title, entry.credits ?? undefined);
      if (next.levels?.length) withLevels += 1;
    }
    // The whole point of the improvement: a meaningful number of generic
    // electives gain a level constraint. Guard against silent regression.
    expect(withLevels).toBeGreaterThan(40);
  });
});

describe("parseElectiveRequirement level capture", () => {
  it("captures a whole-requirement level constraint", () => {
    const req = parseElectiveRequirement("6 optional course units at the 3000 or 4000 level", 6);
    expect(req.type).toBe("elective");
    expect(req.levels).toEqual([3000, 4000]);
  });

  it("keeps levels when a trailing 'of which' clause does not scope the level", () => {
    const req = parseElectiveRequirement(
      "6 course units at the 4000 level, 3 of which can be fulfilled by a special topics course",
      6,
    );
    expect(req.levels).toEqual([4000]);
  });

  it("drops levels when subtotal language scopes them to a subset", () => {
    const req = parseElectiveRequirement(
      "18 course units within the Faculty of Arts, of which at least 12 units must be at the 3000 or 4000 level",
      18,
    );
    expect(req.levels).toBeUndefined();
  });

  it("omits levels when no level clause is present", () => {
    const req = parseElectiveRequirement("9 elective course units", 9);
    expect(req.levels).toBeUndefined();
  });
});
