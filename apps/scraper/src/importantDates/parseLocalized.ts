// Merges the French-localized term structure onto the canonical (English) term,
// asserting the two locales share the exact same section/group/row shape.

import type { ImportantDateTerm } from "@uoplan/core/dataTypes";
import type { CanonicalTerm, LocalizedPage, LocalizedTerm } from "./parseTypes.ts";
import { structuralDriftError } from "./parseText.ts";

export function buildLocalizedTerm(input: {
  canonicalTerm: CanonicalTerm;
  localizedTerm: LocalizedTerm;
  localizedPage: LocalizedPage;
}): ImportantDateTerm {
  const sections = input.canonicalTerm.sections.map((canonicalSection, sectionIndex) => {
    const localizedSection = input.localizedTerm.sections[sectionIndex];
    if (!localizedSection) {
      throw structuralDriftError({
        sourceUrl: input.localizedPage.sourceUrl,
        sourceId: input.canonicalTerm.sourceId,
        category: canonicalSection.category,
        message: `missing localized section at index ${sectionIndex}`,
      });
    }

    const groups = canonicalSection.groups.map((canonicalGroup, groupIndex) => {
      const localizedGroup = localizedSection.groups[groupIndex];
      if (!localizedGroup) {
        throw structuralDriftError({
          sourceUrl: input.localizedPage.sourceUrl,
          sourceId: input.canonicalTerm.sourceId,
          category: canonicalSection.category,
          group: groupIndex,
          message: `missing localized group at index ${groupIndex}`,
        });
      }

      const items = canonicalGroup.items.map((canonicalItem, rowIndex) => {
        const localizedRow = localizedGroup.rows[rowIndex];
        if (!localizedRow) {
          if (input.canonicalTerm.sourcePublished === "false") {
            return {
              ...canonicalItem,
              topic: canonicalItem.topic,
              dateText: canonicalItem.dateText,
              usedEnglishFallback: true,
            };
          }
          throw structuralDriftError({
            sourceUrl: input.localizedPage.sourceUrl,
            sourceId: input.canonicalTerm.sourceId,
            category: canonicalSection.category,
            group: groupIndex,
            row: rowIndex,
            message: `missing localized row at index ${rowIndex}`,
          });
        }

        return {
          ...canonicalItem,
          topic: localizedRow.topic,
          dateText: localizedRow.dateText,
        };
      });

      if (localizedGroup.rows.length > canonicalGroup.items.length) {
        throw structuralDriftError({
          sourceUrl: input.localizedPage.sourceUrl,
          sourceId: input.canonicalTerm.sourceId,
          category: canonicalSection.category,
          group: groupIndex,
          row: canonicalGroup.items.length,
          message: "unexpected extra localized rows",
        });
      }

      return {
        id: canonicalGroup.id,
        ...((localizedGroup.label ?? canonicalGroup.label)
          ? { label: localizedGroup.label ?? canonicalGroup.label }
          : {}),
        ...(canonicalGroup.sessionCode ? { sessionCode: canonicalGroup.sessionCode } : {}),
        items,
      };
    });

    if (localizedSection.groups.length > canonicalSection.groups.length) {
      throw structuralDriftError({
        sourceUrl: input.localizedPage.sourceUrl,
        sourceId: input.canonicalTerm.sourceId,
        category: canonicalSection.category,
        group: canonicalSection.groups.length,
        message: "unexpected extra localized groups",
      });
    }

    return {
      id: canonicalSection.id,
      label: localizedSection.label,
      category: canonicalSection.category,
      groups,
    };
  });

  if (input.localizedTerm.sections.length > input.canonicalTerm.sections.length) {
    throw structuralDriftError({
      sourceUrl: input.localizedPage.sourceUrl,
      sourceId: input.canonicalTerm.sourceId,
      category: "other",
      message: "unexpected extra localized sections",
    });
  }

  return {
    sourceId: input.canonicalTerm.sourceId,
    termId: input.canonicalTerm.termId,
    label: input.localizedTerm.label,
    season: input.canonicalTerm.season,
    year: input.canonicalTerm.year,
    sourcePublished: input.canonicalTerm.sourcePublished,
    termInterval: input.canonicalTerm.termInterval,
    courseInterval: input.canonicalTerm.courseInterval,
    sections,
    sessions: input.canonicalTerm.sessions,
  };
}
