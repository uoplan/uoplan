// Named-session (Spring-Summer A/B/C/…) extraction and reference validation.

import type {
  ImportantDateItem,
  ImportantDateSection,
  ImportantDateTerm,
} from "@uoplan/core/dataTypes";
import { normalizeText } from "./parseText.ts";

// Matches an overview "Courses (Session X)" structural row, distinct from the
// plain "Course dates" row used by standard (non-sessioned) Winter/Fall terms.
const SESSION_TOPIC_PATTERN = /^Courses\s*\(Session\s+([A-Za-z])\)$/i;
// Matches a nested group heading such as "Session A (May 4 to July 24)".
const SESSION_LABEL_PATTERN = /^Session\s+([A-Za-z])\b/i;

function extractSessionCodeFromTopic(topic: string): string | undefined {
  const match = SESSION_TOPIC_PATTERN.exec(normalizeText(topic));
  return match ? match[1].toUpperCase() : undefined;
}

export function extractSessionCodeFromGroupLabel(label: string | undefined): string | undefined {
  if (!label) return undefined;
  const match = SESSION_LABEL_PATTERN.exec(normalizeText(label));
  return match ? match[1].toUpperCase() : undefined;
}

// Derives the term's named-session definitions from English overview rows
// shaped "Courses (Session X)" (e.g. Spring-Summer's A/B/C/…). Standard
// Winter/Fall "Course dates" rows never match and so never create a session.
export function extractSessionDefinitions(input: {
  sourceId: string;
  sourceUrl: string;
  items: ImportantDateItem[];
}): ImportantDateTerm["sessions"] {
  const sessions: ImportantDateTerm["sessions"] = [];
  const seenCodes = new Set<string>();

  for (const item of input.items) {
    const code = extractSessionCodeFromTopic(item.topic);
    if (!code) continue;

    if (seenCodes.has(code)) {
      throw new Error(
        `Duplicate important-date session definition "${code}" for sourceId=${input.sourceId} at ${input.sourceUrl}`,
      );
    }
    if (!item.interval) {
      throw new Error(
        `Missing course interval for important-date session "${code}" for sourceId=${input.sourceId} at ${input.sourceUrl}`,
      );
    }

    seenCodes.add(code);
    sessions.push({ code, courseInterval: item.interval });
  }

  return sessions;
}

// A scoped group (sessionCode set from its "Session X" heading) must reference
// a session actually defined by the term's overview. Only enforced for
// currently published terms — archived terms keep parsing their existing real
// data even if the source ever mislabelled a group.
export function validateSessionReferences(input: {
  sourceId: string;
  sourceUrl: string;
  sourcePublished: "true" | "false";
  sections: ImportantDateSection[];
  sessions: ImportantDateTerm["sessions"];
}): void {
  if (input.sourcePublished !== "true") return;

  const definedCodes = new Set(input.sessions.map((session) => session.code));

  for (const section of input.sections) {
    for (const [groupIndex, group] of section.groups.entries()) {
      if (group.sessionCode && !definedCodes.has(group.sessionCode)) {
        throw new Error(
          `Important dates group references undefined session "${group.sessionCode}" ` +
            `[sourceId=${input.sourceId} category=${section.category} group=${groupIndex}] at ${input.sourceUrl}`,
        );
      }
    }
  }
}
