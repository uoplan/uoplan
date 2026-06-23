import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import type { TimetableFailureDiagnostics } from "@uoplan/core/generationDiagnostics";

import { AppIcon } from "@/components/app-icon";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import { formatGenerationLead, formatSuggestions } from "@/lib/generation-messages";

/**
 * Native analogue of the web `GenerationErrorModal`: a slide-up sheet that
 * surfaces the full structured timetable-failure diagnostics (primary reason,
 * courses with no matching sections, and every quick-fix) on demand from the
 * empty-state "View details" action — keeping the inline empty state concise.
 */
export function GenerationErrorDetailsSheet({
  visible,
  diagnostics,
  onClose,
}: {
  visible: boolean;
  diagnostics: TimetableFailureDiagnostics | null;
  onClose: () => void;
}) {
  const suggestions = diagnostics ? formatSuggestions(diagnostics).filter((s) => s.trim()) : [];
  const noSectionCourses = diagnostics?.coursesWithNoCombo ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Why no schedule?</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <AppIcon name="xmark" size={18} color={Surface.dimmed} />
            </Pressable>
          </View>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.lead}>
              {diagnostics
                ? formatGenerationLead(diagnostics.lead)
                : "These courses can’t all be scheduled together this term."}
            </Text>

            {noSectionCourses.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>No matching sections</Text>
                <Text style={styles.mono}>{noSectionCourses.join(", ")}</Text>
              </View>
            ) : null}

            {suggestions.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionHeading}>Quick fixes</Text>
                {suggestions.map((s) => (
                  <View key={s} style={styles.tipRow}>
                    <AppIcon name="arrow.right" size={13} color={Surface.dimmed} />
                    <Text style={styles.tipText}>{s}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: Surface.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    maxHeight: "75%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Surface.border,
    marginBottom: Spacing.three,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Surface.label,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: Spacing.three,
  },
  lead: {
    fontFamily: Fonts.monoMedium,
    fontSize: 15,
    color: Surface.label,
  },
  section: {
    gap: Spacing.two,
  },
  sectionHeading: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    color: Surface.label,
  },
  mono: {
    fontFamily: Fonts.mono,
    fontSize: 13,
    color: Surface.dimmed,
  },
  tipRow: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "flex-start",
  },
  tipText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Surface.dimmed,
  },
});
