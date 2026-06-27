import { ScrollView, StyleSheet, Text, View } from "react-native";

import { usePagedStepperContentInset } from "@/components/paged-stepper";
import { OptionTree } from "@/components/personalize/option-tree";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import {
  nodeHasOptionGroups,
  type PersonalizeRequirementSelections,
  type PersonalizeRequirementsReadout,
} from "@/lib/personalize-requirements";

interface ProgramOptionsStepProps {
  program: string | null;
  readout: PersonalizeRequirementsReadout | null;
  selections: PersonalizeRequirementSelections;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}

/**
 * The native "Program options" step, mirroring web's Program-options screen.
 * Every branch shows its real contents — the requirement it covers, credit
 * totals, and any further nested choices — instead of a bare "Option 1 / Option
 * 2", and the cards stay visible after a pick so details are never hidden.
 */
export function ProgramOptionsStep({
  program,
  readout,
  selections,
  onChange,
}: ProgramOptionsStepProps) {
  const contentInset = usePagedStepperContentInset();
  const tree = readout?.requirementTreeWithStatus ?? [];
  const optionRoots = tree.filter(nodeHasOptionGroups);

  if (!program || !readout || optionRoots.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyTitle}>No options to choose</Text>
        <Text style={styles.emptyCopy}>
          This program follows a single path, so there is nothing to pick here.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={[styles.scrollContent, { paddingBottom: contentInset }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {optionRoots.map((node, index) => (
        <View key={node.requirementId ?? `${node.type}-${index}`} style={styles.rootCard}>
          <OptionTree node={node} selections={selections} onChange={onChange} />
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    gap: Spacing.three,
  },
  rootCard: {
    gap: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 22,
    backgroundColor: Surface.card,
    padding: Spacing.three,
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
