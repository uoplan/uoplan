import type { CoursePrereqNode } from "@uoplan/domain/dataTypes";
import { normalizeCourseCode } from "@uoplan/domain/utils/courseUtils";
import { classifyNonCourse, parseCoursePrerequisites } from "../../../catalogue/prerequisites.ts";

function normalizeText(text: string): string {
  return text.replaceAll("\u00a0", " ").replaceAll(/\s+/g, " ").trim();
}

function stripTrailingPeriod(text: string): string {
  return text.replace(/[.;]\s*$/, "").trim();
}

function stripGradeProse(text: string): string {
  return text
    .replace(/\s+with\s+(?:a\s+)?minimum\s+grade\s+of\s+[A-F][+-]?.*$/i, "")
    .replace(/\s+with\s+(?:a\s+)?grade\s+of\s+[A-F][+-]?.*$/i, "")
    .trim();
}

function cleanNode(node: CoursePrereqNode): CoursePrereqNode {
  if (node.children) node.children = node.children.map(cleanNode);
  for (const key of Object.keys(node) as Array<keyof CoursePrereqNode>) {
    if (node[key] === undefined) delete node[key];
  }
  return node;
}

function classifyCarletonNonCourse(text: string): CoursePrereqNode | undefined {
  if (/^(?:first|second|third|fourth)[- ]year standing$/i.test(text)) {
    return { type: "non_course", text, kind: "standing" };
  }
  return undefined;
}

function parseLevels(text: string): number[] | undefined {
  const levelMatch = text.match(/\bat\s+the\s+(\d000)[- ]level(?:\s+or\s+above)?\b/i);
  if (!levelMatch) return undefined;
  const level = Number.parseInt(levelMatch[1], 10);
  if (!/or\s+above/i.test(levelMatch[0])) return [level];
  const levels: number[] = [];
  for (let next = level; next <= 4000; next += 1000) levels.push(next);
  return levels;
}

function parseDisciplineCreditPool(text: string): CoursePrereqNode | undefined {
  const match = text.match(
    /^(\d+(?:\.\d+)?)\s+credits?\s+in\s+([A-Z]{3,4})(?:\s+at\s+the\s+\d000[- ]level(?:\s+or\s+above)?)?$/i,
  );
  if (!match) return undefined;
  const node: CoursePrereqNode = {
    type: "non_course",
    text,
    credits: Number.parseFloat(match[1]),
    disciplines: [match[2].toUpperCase()],
  };
  const levels = parseLevels(text);
  if (levels) node.disciplineLevels = [{ discipline: match[2].toUpperCase(), levels }];
  return node;
}

function normalizeNodeCodes(node: CoursePrereqNode): CoursePrereqNode {
  if (node.code) node.code = normalizeCourseCode(node.code);
  if (node.children) {
    for (const child of node.children) normalizeNodeCodes(child);
  }
  return node;
}

function annotateOpaque(node: CoursePrereqNode): CoursePrereqNode {
  if (node.type === "non_course" && !node.kind && node.text) {
    const kind = classifyNonCourse(node.text);
    if (kind) node.kind = kind;
  }
  if (node.children) {
    for (const child of node.children) annotateOpaque(child);
  }
  return node;
}

export function parseCarletonPrereqs(text: string): CoursePrereqNode | undefined {
  const withoutLabel = normalizeText(text).replace(/^Prerequisite\(s\):\s*/i, "");
  const body = stripTrailingPeriod(stripGradeProse(withoutLabel));
  if (!body) return undefined;

  const creditPool = parseDisciplineCreditPool(body);
  if (creditPool) return creditPool;
  const carletonNonCourse = classifyCarletonNonCourse(body);
  if (carletonNonCourse) return carletonNonCourse;

  const parsed = parseCoursePrerequisites(body);
  if (!parsed) {
    return annotateOpaque({ type: "non_course", text: body });
  }
  return cleanNode(annotateOpaque(normalizeNodeCodes(parsed)));
}
