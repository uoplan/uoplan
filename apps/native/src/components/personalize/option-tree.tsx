import { Pressable, StyleSheet, Text, View } from "react-native";

import type { RequirementWithStatus } from "@uoplan/core/requirements";

import { AppIcon } from "@/components/app-icon";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import {
  getNodeDisplayTitle,
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

/** Max concrete course-code chips shown on a leaf before collapsing to "+N more". */
const MAX_COURSE_CHIPS = 8;

/** The accent "credits" pill for a node, or null when it has no credit total. */
function creditsBadge(node: RequirementWithStatus): BadgeSpec | null {
  const credits = node.creditsNeeded ?? 0;
  if (credits <= 0) return null;
  return { label: `${credits} credit${credits === 1 ? "" : "s"}`, tone: "accent" };
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

type BadgeTone = "accent" | "neutral";

interface BadgeSpec {
  label: string;
  tone: BadgeTone;
}

/** Small at-a-glance facts for a requirement node, shown as pills. */
function nodeBadges(node: RequirementWithStatus): BadgeSpec[] {
  const badges: BadgeSpec[] = [];
  const credits = node.creditsNeeded ?? 0;
  if (credits > 0) {
    badges.push({ label: `${credits} credit${credits === 1 ? "" : "s"}`, tone: "accent" });
  }
  const courses = node.candidateCourses?.length ?? 0;
  if (courses > 0) {
    badges.push({ label: `${courses} course${courses === 1 ? "" : "s"}`, tone: "neutral" });
  }
  return badges;
}

function Badge({ label, tone }: BadgeSpec) {
  return (
    <View style={[styles.badge, tone === "accent" ? styles.badgeAccent : styles.badgeNeutral]}>
      <Text style={[styles.badgeText, tone === "accent" ? styles.badgeTextAccent : null]}>
        {label}
      </Text>
    </View>
  );
}

function BadgeRow({ node }: { node: RequirementWithStatus }) {
  const badges = nodeBadges(node);
  if (badges.length === 0) return null;
  return (
    <View style={styles.badgeRow}>
      {badges.map((badge, index) => (
        <Badge key={`${badge.label}-${index}`} label={badge.label} tone={badge.tone} />
      ))}
    </View>
  );
}

/**
 * Concrete at-a-glance facts for a leaf requirement: a credits pill plus the
 * actual qualifying course codes as chips (capped at MAX_COURSE_CHIPS with a
 * "+N more" overflow), so a long catalogue sentence reads as scannable badges
 * instead of a wall of "X or Y or Z" prose.
 */
function LeafFacts({ node }: { node: RequirementWithStatus }) {
  const credits = creditsBadge(node);
  const courses = node.candidateCourses ?? [];
  const shown = courses.slice(0, MAX_COURSE_CHIPS);
  const extra = courses.length - shown.length;
  if (!credits && courses.length === 0) return null;
  return (
    <View style={styles.badgeRow}>
      {credits ? <Badge label={credits.label} tone={credits.tone} /> : null}
      {shown.map((code) => (
        <Badge key={code} label={code} tone="neutral" />
      ))}
      {extra > 0 ? <Badge label={`+${extra} more`} tone="neutral" /> : null}
    </View>
  );
}

/**
 * Read-only renderer for an option's structure as nested **sub-cards** (mirrors
 * web's OptionRequirementPreview): each nested requirement / choice group is its
 * own bordered box with a title and badge pills, so the structure reads as
 * proper boxes instead of a wall of indented text. When `bare`, the outermost
 * box is dropped because the enclosing option card already provides it.
 */
function NestedRequirement({
  node: rawNode,
  bare = false,
}: {
  node: RequirementWithStatus;
  bare?: boolean;
}) {
  const node = simplifySingleChildChain(rawNode);
  const hasOptions = (node.options?.length ?? 0) > 0;
  const isChoiceGroup = node.type === "or_group" || node.type === "options_group";

  if (isChoiceGroup && hasOptions) {
    const children = (
      <>
        <Text style={styles.chooseHint}>Choose one</Text>
        <View style={styles.subChildren}>
          {node.options!.map((child, index) => (
            <NestedRequirement key={child.requirementId ?? `${child.type}-${index}`} node={child} />
          ))}
        </View>
      </>
    );
    if (bare) return <View style={styles.nestedSection}>{children}</View>;
    return (
      <View style={styles.subCard}>
        <Text style={styles.subTitle} numberOfLines={2}>
          {groupLabel(node)}
        </Text>
        {children}
      </View>
    );
  }

  if (node.type === "and" && hasOptions) {
    const children = (
      <View style={styles.subChildren}>
        {node.options!.map((child, index) => (
          <NestedRequirement key={child.requirementId ?? `${child.type}-${index}`} node={child} />
        ))}
      </View>
    );
    if (bare) return <View style={styles.nestedSection}>{children}</View>;
    return (
      <View style={styles.subCard}>
        {node.title ? (
          <Text style={styles.subTitle} numberOfLines={2}>
            {getNodeDisplayTitle(node)}
          </Text>
        ) : null}
        {children}
      </View>
    );
  }

  return (
    <View style={styles.subCard}>
      <Text style={styles.subTitle} numberOfLines={2}>
        {getNodeDisplayTitle(node)}
      </Text>
      <LeafFacts node={node} />
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
 * A selectable option card that fully shows the option's structure as sub-cards
 * and badges. The card stays expanded whether or not it is the chosen one, so
 * picking an option never hides the details — the selected card is simply
 * highlighted with a check.
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
      <BadgeRow node={option} />
      {hasNestedStructure(option) ? <NestedRequirement node={option} bare /> : null}
    </Pressable>
  );
}

/**
 * Selection + drill-down renderer for a program option tree (mirrors web's
 * OptionsDrilldown). Option groups render as selectable cards that show their
 * full structure and stay visible after a pick — the chosen card is highlighted
 * and any nested choices for that branch drill in below inside an inset panel.
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
        <Text style={styles.groupLabel} numberOfLines={2}>
          {groupLabel(node)}
        </Text>
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
          <View style={styles.drilldown}>
            <Text style={styles.drilldownLabel}>Next choice</Text>
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

  return <NestedRequirement node={node} />;
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
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: Spacing.one,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  badgeAccent: {
    backgroundColor: Surface.accentSoft,
    borderColor: Surface.accent,
  },
  badgeNeutral: {
    backgroundColor: Surface.subtle,
    borderColor: Surface.border,
  },
  badgeText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    color: Surface.dimmed,
  },
  badgeTextAccent: {
    color: Surface.accent,
  },
  nestedSection: {
    gap: Spacing.two,
    marginTop: Spacing.half,
  },
  subChildren: {
    gap: Spacing.two,
  },
  subCard: {
    gap: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 12,
    backgroundColor: Surface.card,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  subTitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    lineHeight: 18,
    color: Surface.label,
  },
  chooseHint: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Surface.dimmed,
  },
  drilldown: {
    gap: Spacing.two,
    marginTop: Spacing.one,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    borderRadius: 16,
    backgroundColor: Surface.subtle,
    padding: Spacing.three,
  },
  drilldownLabel: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.3,
    textTransform: "uppercase",
    color: Surface.dimmed,
  },
  andStack: {
    gap: Spacing.two,
  },
});
