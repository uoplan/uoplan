import { extractCourseCodes } from "../shared/text.ts";
import type { ProgramRequirement } from "./schema.ts";
import {
  extractDisciplines,
  parseCreditRequirement,
  parseLevelsFromClause,
} from "./prerequisites.ts";

/**
 * Capture course-level constraints ("at the 3000 or 4000 level") only when they
 * apply to the WHOLE requirement. Subtotal phrasing such as "…of which at least
 * 12 units must be at the 3000 or 4000 level" scopes the levels to a subset of
 * the credits, so attaching them to the requirement would wrongly force the
 * entire pool to those levels. In that case we drop the levels (conservative:
 * keep the old broad pool) rather than over-constrain.
 */
function wholeRequirementLevels(text: string): number[] | undefined {
  const levels = parseLevelsFromClause(text);
  if (!levels) return undefined;
  const levelClause = text.match(/\b(?:at the|de niveau|au niveau)\b/i);
  const before = levelClause ? text.slice(0, levelClause.index ?? 0) : text;
  if (/\bof which\b|\bat least\b|\bdont\b|\bau moins\b|\bparmi\b/i.test(before)) {
    return undefined;
  }
  return levels;
}

export function parseElectiveRequirement(text: string, credits?: number): ProgramRequirement {
  const trimmed = text.replace(/^\s*(and|or)\s+/i, "").trim();

  const effectiveCredits = credits ?? parseCreditRequirement(trimmed);
  // Level constraints on a discipline-less elective ("… at the 3000 or 4000
  // level") are otherwise dropped; capture them so candidate resolution can
  // narrow the pool. Discipline-bearing branches keep using `disciplineLevels`.
  const fallbackLevels = wholeRequirementLevels(trimmed);

  if (/free elective/i.test(trimmed)) {
    return {
      type: "free_elective",
      title: trimmed,
      credits: effectiveCredits,
      ...(fallbackLevels ? { levels: fallbackLevels } : {}),
    };
  }

  const orParts = trimmed
    .split(/;\s*or\s+/i)
    .map((s) => s.trim())
    .filter(Boolean);
  if (orParts.length > 1) {
    const allSubsequentLackCredits = orParts
      .slice(1)
      .every((p) => parseCreditRequirement(p) == null);

    if (allSubsequentLackCredits) {
      // Subsequent parts have no credit spec of their own — they share the same credit pool.
      // Collect all disciplines/courses from every part into a single pick.
      const allOptions: ProgramRequirement[] = [];
      for (const part of orParts) {
        const p = part.replace(/^\s*(and|or)\s+/i, "").trim();
        const partDisciplines = extractDisciplines(p);
        const partLevels = parseLevelsFromClause(p);
        const partCourses = extractCourseCodes(p);
        for (const d of partDisciplines) {
          allOptions.push({
            type: "discipline_elective",
            title: `Any ${d}${partLevels ? ` at ${partLevels.join(" or ")} level` : ""}`,
            disciplineLevels: [{ discipline: d, levels: partLevels }],
          });
        }
        for (const c of partCourses) {
          allOptions.push({ type: "course", code: c });
        }
      }
      if (allOptions.length === 1) {
        return { ...allOptions[0], credits: effectiveCredits, title: trimmed };
      }
      if (allOptions.length > 1) {
        return { type: "pick", title: trimmed, credits: effectiveCredits, options: allOptions };
      }
      // Fall through to or_group if no disciplines/courses found in any part
    }

    return {
      type: "or_group",
      title: "or",
      options: orParts.map((p) => parseElectiveRequirement(p, credits)),
    };
  }

  if (/non[- ]/i.test(trimmed)) {
    const exclusions: string[] = [];
    if (/computing|computer/i.test(trimmed)) exclusions.push("CEG", "CSI", "SEG", "ELG");
    if (/mathematic/i.test(trimmed)) exclusions.push("MAT");
    return {
      type: "non_discipline_elective",
      title: trimmed,
      credits: effectiveCredits,
      excluded_disciplines: exclusions.length > 0 ? exclusions : undefined,
      ...(fallbackLevels ? { levels: fallbackLevels } : {}),
    };
  }

  if (/Faculty of/i.test(trimmed)) {
    return {
      type: "faculty_elective",
      title: trimmed,
      credits: effectiveCredits,
      ...(fallbackLevels ? { levels: fallbackLevels } : {}),
    };
  }
  if (/in science/i.test(trimmed)) {
    return {
      type: "faculty_elective",
      title: trimmed,
      credits: effectiveCredits,
      faculty: "Science",
      ...(fallbackLevels ? { levels: fallbackLevels } : {}),
    };
  }

  const disciplines = extractDisciplines(trimmed);
  const levels = parseLevelsFromClause(trimmed);
  const explicitCourses = extractCourseCodes(trimmed);

  if (disciplines.length > 0 || explicitCourses.length > 0) {
    const options: ProgramRequirement[] = [];

    for (const d of disciplines) {
      options.push({
        type: "discipline_elective",
        title: `Any ${d}${levels ? ` at ${levels.join(" or ")} level` : ""}`,
        disciplineLevels: [{ discipline: d, levels }],
      });
    }

    for (const c of explicitCourses) {
      options.push({ type: "course", code: c });
    }

    if (options.length === 1) {
      return { ...options[0], credits: effectiveCredits, title: trimmed };
    }

    return {
      type: "pick",
      title: trimmed,
      credits: effectiveCredits,
      options,
    };
  }

  return {
    type: "elective",
    title: trimmed,
    credits: effectiveCredits,
    ...(fallbackLevels ? { levels: fallbackLevels } : {}),
  };
}

export function parseUnits(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d+)?)/);
  if (match) return parseFloat(match[1]);
  return undefined;
}

export function processRequirements(reqs: ProgramRequirement[]): ProgramRequirement[] {
  const cleaned = reqs.map((r) => {
    const newR: ProgramRequirement = { ...r };
    if (newR.type === "group" && (!newR.options || newR.options.length === 0)) {
      newR.type = "elective";
      delete newR.options;
    }
    if (newR.options && newR.options.length === 0) {
      delete newR.options;
    }
    const withoutUndefined = Object.fromEntries(
      Object.entries(newR).filter(([, value]) => value !== undefined),
    );
    return withoutUndefined as ProgramRequirement;
  });

  const foldedOptions: ProgramRequirement[] = [];
  let currentOptionsGroup: ProgramRequirement | null = null;
  let currentOptionList: ProgramRequirement[] | null = null;
  // Whether the current option branch is "indented-style": its header (and
  // therefore its children) are visually indented in the source table. When
  // true, the end of indentation marks the end of the option (and the whole
  // options group). Flat-style options (no indentation) instead rely on the
  // next section as their boundary.
  let currentOptionIndented = false;

  const isOptionHeader = (r: ProgramRequirement): boolean =>
    !!r.title && /^(?:option|opiton)\b/i.test(r.title.trim());

  const startOptionBranch = (r: ProgramRequirement): ProgramRequirement[] => {
    if (!currentOptionsGroup) {
      currentOptionsGroup = {
        type: "options_group",
        title: "Options",
        options: [],
      };
      foldedOptions.push(currentOptionsGroup);
    }

    currentOptionIndented = !!r.indented;

    const optionList: ProgramRequirement[] = [];
    currentOptionsGroup.options!.push({
      type: "and",
      title: r.title,
      options: optionList,
    });
    return optionList;
  };

  const closeOptionsGroup = (): void => {
    currentOptionsGroup = null;
    currentOptionList = null;
    currentOptionIndented = false;
  };

  for (let i = 0; i < cleaned.length; i++) {
    const r = cleaned[i];

    if (
      (r.type === "elective" || r.type === "group" || r.type === "section") &&
      r.title &&
      r.title.toLowerCase().includes("option from the following")
    ) {
      currentOptionsGroup = {
        type: "options_group",
        title: r.title,
        ...(r.credits != null ? { credits: r.credits } : {}),
        options: [],
      };
      currentOptionList = null;
      currentOptionIndented = false;
      foldedOptions.push(currentOptionsGroup);
      continue;
    }

    if (isOptionHeader(r) && (r.type === "section" || currentOptionsGroup)) {
      currentOptionList = startOptionBranch(r);
      continue;
    }

    if (currentOptionList !== null) {
      const optionList = currentOptionList;
      if (r.type === "section") {
        closeOptionsGroup();
        foldedOptions.push(r);
      } else if (currentOptionIndented && !r.indented) {
        // The option's children are indented; this non-indented requirement is
        // outside the option (and the whole options group).
        closeOptionsGroup();
        foldedOptions.push(r);
      } else {
        optionList.push(r);
      }
    } else {
      foldedOptions.push(r);
    }
  }

  const foldedSections: ProgramRequirement[] = [];
  let sectionStack: ProgramRequirement[] = [];

  const isYearSection = (title: string): boolean => /^years?\b/i.test(title.trim());
  const isTermSection = (title: string): boolean =>
    /\b(?:fall|winter|spring|summer)\s+term\b/i.test(title);
  const isUnitParentSection = (title: string): boolean =>
    /\(\d+(?:\.\d+)?\s*(?:course\s*)?units?\)$/i.test(title.trim());
  const isChildSection = (
    parentTitle: string | undefined,
    childTitle: string | undefined,
  ): boolean => {
    if (!parentTitle || !childTitle) return false;
    if (isYearSection(parentTitle)) return isTermSection(childTitle);
    if (/^home university\b/i.test(parentTitle.trim())) return isTermSection(childTitle);
    if (isUnitParentSection(parentTitle)) return !isUnitParentSection(childTitle);
    return false;
  };

  for (let i = 0; i < foldedOptions.length; i++) {
    const r = foldedOptions[i];

    if (r.type === "section") {
      if (r.title && r.title.toLowerCase() === "or") {
        const currentContainer = sectionStack.length
          ? sectionStack[sectionStack.length - 1].options!
          : foldedSections;
        const last = currentContainer.pop();
        const orGroup: ProgramRequirement = {
          type: "or_group",
          options: last ? [last] : [],
        };
        currentContainer.push(orGroup);
        const alternative: ProgramRequirement = { type: "and", title: "Alternative", options: [] };
        orGroup.options!.push(alternative);
        sectionStack = [...sectionStack, alternative];
      } else {
        const nextSection: ProgramRequirement = {
          type: "and",
          title: r.title,
          options: [],
        };

        let parentIndex = -1;
        if (r.indented && sectionStack.length > 0) {
          parentIndex = sectionStack.length - 1;
        } else {
          for (let j = sectionStack.length - 1; j >= 0; j--) {
            if (isChildSection(sectionStack[j].title, r.title)) {
              parentIndex = j;
              break;
            }
          }
        }

        if (parentIndex >= 0) {
          sectionStack = sectionStack.slice(0, parentIndex + 1);
          sectionStack[parentIndex].options!.push(nextSection);
          sectionStack.push(nextSection);
        } else {
          foldedSections.push(nextSection);
          sectionStack = [nextSection];
        }
      }
    } else if (sectionStack.length > 0) {
      sectionStack[sectionStack.length - 1].options!.push(r);
    } else {
      foldedSections.push(r);
    }
  }

  return foldedSections;
}
