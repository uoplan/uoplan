import { StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { GradeHistogram } from "@/components/grade-histogram";
import { Spacing, Surface } from "@/constants/theme";
import type { SectionOffering } from "@/data/explore-detail";
import { formatTermLabel } from "@/data/trends-data";

/**
 * Per-section breakdown shown inside an expanded professor (course page) or
 * course (professor page) collapsible: one row per (term, section) the
 * professor taught, each with its own grade histogram. The native analogue of
 * the web `ExploreProfessorOfferingRows`.
 */
export function SectionOfferingsList({ offerings }: { offerings: SectionOffering[] }) {
  if (offerings.length === 0) {
    return (
      <Text size="sm" dimmed>
        No per-section grade data yet.
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {offerings.map((offering, index) => (
        <View
          key={`${offering.termId}-${offering.section ?? ""}`}
          style={[styles.row, index === offerings.length - 1 ? styles.rowLast : null]}
        >
          <View style={styles.header}>
            <Text size="sm" weight="semibold" color={Surface.label}>
              {formatTermLabel(offering.termId)}
            </Text>
            {offering.section ? (
              <Text size="xs" color={Surface.dimmed}>
                Section {offering.section}
              </Text>
            ) : null}
          </View>
          {offering.gradeViz ? (
            <GradeHistogram
              gradeViz={offering.gradeViz}
              maxBarPx={56}
              showSummary
              showStudentCount
            />
          ) : (
            <Text size="xs" dimmed>
              No grades recorded for this section.
            </Text>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  row: {
    gap: Spacing.two,
    paddingBottom: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Surface.border,
  },
  rowLast: {
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  header: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
});
