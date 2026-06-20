import { Pressable, StyleSheet, Text, View } from "react-native";

import type { RequirementWithStatus } from "@uoplan/core/requirements";

import { AppIcon } from "@/components/app-icon";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import {
  getNodeDisplayTitle,
  getOptionSecondarySummaryLine,
  nodeHasOptionGroups,
  setSelectedOptionForRequirement,
  simplifySingleChildChain,
  type PersonalizeRequirementSelections,
} from "@/lib/personalize-requirements";

interface SharedProps {
  selections: PersonalizeRequirementSelections;
  onChange: (selections: PersonalizeRequirementSelections) => void;
}

function groupLabel(node: RequirementWithStatus): string {
  const rawTitle = (node.title ?? "").trim();
  const generic = rawTitle === "" || rawTitle.toLowerCase() === "or";
  return generic ? "Choose one of the following" : rawTitle;
}

function leafLabel(node: RequirementWithStatus): string {
  const title = getNodeDisplayTitle(node);
  const credits = node.creditsNeeded ?? 0;
  if (credits > 0 && !(node.complete && node.satisfiedBy.length > 0)) {
    return `${title} (${credits} credit${credits === 1 ? "" : "s"} needed)`;
  }
  return title;
}

/** True when an option still has meaningful structure worth previewing inline. */
function hasNestedStructure(node: RequirementWithStatus): boolean {
  return nodeHasOptionGroups(node) || (node.type === "and" && (node.options?.length ?? 0) > 0);
}

/** Heading for a selectable option: its real title, falling back to "Option N". */
function optionHeading(node: RequirementWithStatus, ordinal: number): string {
  const title = getNodeDisplayTitle(node).trim();
  if (title === "" || title.toLowerCase() === "or") return `Option ${ordinal}`;
  return title;
}

/**
 * Read-only renderer for an option's structure (mirrors web's
 * OptionRequirementPreview). Recursively shows nested choice groups and the
 * requirement each branch covers — but deliberately not the individual courses,
 * keeping the choice easy to read.
 */
function OptionPreview({
  node: rawNode,
  hideTopTitle = false,
}: {
  node: RequirementWithStatus;
  hideTopTitle?: boolean;
}) {
  const node = simplifySingleChildChain(rawNode);
  const hasOptions = (node.options?.length ?? 0) > 0;
  const isChoiceGroup = node.type === "or_group" || node.type === "options_group";

  if (isChoiceGroup && hasOptions) {
    return (
      <View style={styles.previewGroup}>
        {hideTopTitle ? null : <Text style={styles.previewGroupLabel}>{groupLabel(node)}</Text>}
        <Text style={styles.previewHint}>Choose one:</Text>
        <View style={styles.previewChoices}>
          {node.options!.map((child, index) => (
            <View
              key={child.requirementId ?? `${child.type}-${index}`}
              style={styles.previewChoice}
            >
              <OptionPreview node={child} />
            </View>
          ))}
        </View>
      </View>
    );
  }

  if (node.type === "and" && hasOptions) {
    return (
      <View style={styles.previewStack}>
        {hideTopTitle || !node.title ? null : (
          <Text style={styles.previewGroupLabel}>{getNodeDisplayTitle(node)}</Text>
        )}
        {node.options!.map((child, index) => (
          <OptionPreview key={child.requirementId ?? `${child.type}-${index}`} node={child} />
        ))}
      </View>
    );
  }

  const summary = getOptionSecondarySummaryLine(node);

  return (
    <View style={styles.previewLeaf}>
      {hideTopTitle ? (
        summary ? (
          <Text style={styles.previewSummary}>{summary}</Text>
        ) : null
      ) : (
        <Text style={styles.previewLeafTitle}>{leafLabel(node)}</Text>
      )}
    </View>
  );
}

/** Numbered indicator (①②③) shown on each selectable option card. */
function NumberCircle({ number, selected }: { number: number; selected: boolean }) {
  return (
    <View style={[styles.circle, selected ? styles.circleSelected : null]}>
      <Text style={[styles.circleText, selected ? styles.circleTextSelected : null]}>{number}</Text>
    </View>
  );
}

/**
 * A selectable option card that fully shows the option's structure. The card
 * stays expanded whether or not it is the chosen one, so picking an option never
 * hides the details — the selected card is simply highlighted with a check.
 */
function OptionCard({
  option,
  ordinal,
  selected,
  onPress,
}: {
  option: RequirementWithStatus;
  ordinal: number;
  selected: boolean;
  onPress: () => void;
}) {
  const heading = optionHeading(option, ordinal);
  const summary = getOptionSecondarySummaryLine(option);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`Option ${ordinal}: ${heading}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        selected ? styles.cardSelected : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <View style={styles.cardHeader}>
        <NumberCircle number={ordinal} selected={selected} />
        <Text style={styles.cardHeading} numberOfLines={2}>
          {heading}
        </Text>
        <AppIcon
          name={selected ? "checkmark.circle.fill" : "circle"}
          size={20}
          color={selected ? Surface.accent : Surface.dimmed}
          weight="semibold"
        />
      </View>
      {summary ? <Text style={styles.cardSummary}>{summary}</Text> : null}
      {hasNestedStructure(option) ? <OptionPreview node={option} hideTopTitle /> : null}
    </Pressable>
  );
}

/**
 * Selection + drill-down renderer for a program option tree (mirrors web's
 * OptionsDrilldown). Option groups render as selectable cards that show their
 * full structure and stay visible after a pick — the chosen card is highlighted
 * and any nested choices for that branch drill in below along a left rail.
 */
export function OptionTree({
  node: rawNode,
  selections,
  onChange,
}: SharedProps & { node: RequirementWithStatus }) {
  const node = simplifySingleChildChain(rawNode);

  const isOptionGroup =
    (node.type === "or_group" || node.type === "options_group") &&
    node.requirementId != null &&
    !node.complete &&
    (node.options?.length ?? 0) > 0;

  if (isOptionGroup) {
    const reqId = node.requirementId!;
    const options = node.options!;
    const selectedIdx = selections.selectedOptionsPerRequirement[reqId];
    const selOk = selectedIdx != null && selectedIdx >= 0 && selectedIdx < options.length;
    const selectedChild = selOk ? options[selectedIdx]! : null;

    return (
      <View style={styles.group}>
        <Text style={styles.groupLabel}>{groupLabel(node)}</Text>
        <View style={styles.cards}>
          {options.map((opt, index) => (
            <OptionCard
              key={opt.requirementId ?? `${reqId}-${index}`}
              option={opt}
              ordinal={index + 1}
              selected={selectedIdx === index}
              onPress={() => onChange(setSelectedOptionForRequirement(selections, reqId, index))}
            />
          ))}
        </View>
        {selectedChild && nodeHasOptionGroups(selectedChild) ? (
          <View style={styles.rail}>
            <OptionTree node={selectedChild} selections={selections} onChange={onChange} />
          </View>
        ) : null}
      </View>
    );
  }

  if (node.type === "and" && node.options?.length) {
    return (
      <View style={styles.andStack}>
        {node.options.map((child, index) => (
          <OptionTree
            key={child.requirementId ?? `${child.type}-${index}`}
            node={child}
            selections={selections}
            onChange={onChange}
          />
        ))}
      </View>
    );
  }

  return <OptionPreview node={node} />;
}

const styles = StyleSheet.create({
  group: {
    gap: Spacing.two,
  },
  groupLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 15,
    fontWeight: "700",
    color: Surface.label,
  },
  cards: {
    gap: Spacing.two,
  },
  card: {
    gap: Spacing.two,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.page,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  cardSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.subtle,
  },
  pressed: {
    opacity: 0.7,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  cardHeading: {
    flex: 1,
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    fontWeight: "700",
    color: Surface.label,
  },
  cardSummary: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: Surface.dimmed,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.page,
  },
  circleSelected: {
    borderColor: Surface.accent,
    backgroundColor: Surface.accent,
  },
  circleText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    fontWeight: "700",
    color: Surface.dimmed,
  },
  circleTextSelected: {
    color: Surface.onAccent,
  },
  rail: {
    gap: Spacing.two,
    marginLeft: Spacing.two,
    paddingLeft: Spacing.three,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Surface.border,
  },
  andStack: {
    gap: Spacing.two,
  },
  previewGroup: {
    gap: Spacing.one,
  },
  previewGroupLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.label,
  },
  previewHint: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Surface.dimmed,
  },
  previewChoices: {
    gap: Spacing.one,
  },
  previewChoice: {
    gap: Spacing.half,
    marginLeft: Spacing.one,
    paddingLeft: Spacing.two,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: Surface.border,
  },
  previewStack: {
    gap: Spacing.one,
  },
  previewLeaf: {
    gap: Spacing.half,
  },
  previewLeafTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Surface.label,
  },
  previewSummary: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    lineHeight: 17,
    color: Surface.dimmed,
  },
});
