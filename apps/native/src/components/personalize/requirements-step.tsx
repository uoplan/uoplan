import { ScrollView, StyleSheet, Text, View } from "react-native";

import { usePagedStepperContentInset } from "@/components/paged-stepper";
import { RequirementPlanner } from "@/components/personalize/requirement-planner";
import { PillButton } from "@/components/redesign/pill-button";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import type {
  PersonalizeRequirementSelections,
  PersonalizeRequirementsReadout,
} from "@/lib/personalize-requirements";

interface RequirementsStepProps {
  program: string | null;
  readout: PersonalizeRequirementsReadout | null;
  selections: PersonalizeRequirementSelections;
  titleForCourse: (code: string) => string | undefined;
  onChange: (selections: PersonalizeRequirementSelections) => void;
  generateLabel: string;
  canGenerate: boolean;
  onGenerate: () => void;
}

export function RequirementsStep({
  program,
  readout,
  selections,
  titleForCourse,
  onChange,
  generateLabel,
  canGenerate,
  onGenerate,
}: RequirementsStepProps) {
  const remainingCount = readout?.remainingCount ?? null;
  const unassignedCount = readout?.unassignedCompletedCourses.length ?? 0;
  const summaryTitle =
    remainingCount === null
      ? program
        ? "No requirements to fill"
        : "Pick a program to fill requirements"
      : unassignedCount === 0
        ? "Ready to generate"
        : `${unassignedCount} completed course${unassignedCount === 1 ? "" : "s"} to assign`;
  const summaryCopy =
    remainingCount === null
      ? program
        ? "This program has no extra requirement choices in the loaded catalogue."
        : "Once your program is selected, this step shows only the choices that still need attention."
      : unassignedCount === 0
        ? "Your completed courses are placed automatically. Fine-tune priorities or course load, then generate."
        : "Place the remaining completed courses below to continue. You don't need to fill every requirement.";

  const handleGenerate = () => {
    if (canGenerate) onGenerate();
  };

  const contentInset = usePagedStepperContentInset();

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: contentInset }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>{summaryTitle}</Text>
          <Text style={styles.summaryCopy}>{summaryCopy}</Text>
        </View>

        {readout ? (
          <RequirementPlanner
            readout={readout}
            selections={selections}
            titleForCourse={titleForCourse}
            onChange={onChange}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Nothing to choose yet</Text>
            <Text style={styles.emptyCopy}>
              Select a program in the previous step to see any requirement choices here.
            </Text>
          </View>
        )}

        <PillButton
          label={generateLabel}
          onPress={handleGenerate}
          variant={canGenerate ? "primary" : "secondary"}
          disabled={!canGenerate}
          accessibilityLabel={generateLabel}
          style={styles.generateButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.three,
  },
  summary: {
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 20,
    backgroundColor: Surface.card,
    padding: Spacing.three,
  },
  summaryTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 16,
    fontWeight: "700",
    color: Surface.label,
  },
  summaryCopy: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: Surface.dimmed,
  },
  generateButton: {
    alignSelf: "stretch",
    marginTop: Spacing.one,
  },
  empty: {
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 22,
    backgroundColor: Surface.subtle,
    padding: Spacing.four,
  },
  emptyTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 16,
    fontWeight: "700",
    color: Surface.label,
  },
  emptyCopy: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 19,
    color: Surface.dimmed,
  },
});
