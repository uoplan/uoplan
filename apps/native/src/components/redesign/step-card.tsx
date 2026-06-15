import type { ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";

export type StepStatus = "done" | "active" | "pending";

const STATUS: Record<StepStatus, { bar: string | null; icon: IconName; color: string }> = {
  done: { bar: "#318c4c", icon: "checkmark.circle.fill", color: "#318c4c" },
  active: { bar: "#bd7221", icon: "exclamationmark.circle", color: "#bd7221" },
  pending: { bar: null, icon: "circle", color: Surface.faint },
};

interface StepCardProps {
  /** Small caps eyebrow, e.g. "Term". */
  stepLabel: string;
  /** The step's headline value/status, e.g. "Fall 2026" / "Program not selected". */
  title: string;
  status: StepStatus;
  expanded: boolean;
  onToggle: () => void;
  /** Disable the header press (e.g. a step gated on an earlier one). */
  disabled?: boolean;
  children?: ReactNode;
}

/**
 * A wizard step card matching the web mobile personalize accordion: a leading
 * status accent bar (green=done, rust=active), an eyebrow + headline header with
 * a status icon and a collapse chevron, and collapsible body content.
 */
export function StepCard({
  stepLabel,
  title,
  status,
  expanded,
  onToggle,
  disabled,
  children,
}: StepCardProps) {
  const meta = STATUS[status];
  return (
    <View style={styles.card}>
      {meta.bar ? <View style={[styles.bar, { backgroundColor: meta.bar }]} /> : null}
      <Pressable
        onPress={onToggle}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        style={styles.header}
      >
        <View style={styles.headerText}>
          <Text size="xs" weight="bold" color={Surface.dimmed}>
            {stepLabel}
          </Text>
          <Text size="lg" weight="bold" color={disabled ? Surface.dimmed : Surface.label}>
            {title}
          </Text>
        </View>
        <View style={styles.headerIcons}>
          <AppIcon name={meta.icon} size={20} color={meta.color} />
          {!disabled ? (
            <AppIcon
              name={expanded ? "chevron.up" : "chevron.down"}
              size={16}
              color={Surface.dimmed}
            />
          ) : null}
        </View>
      </Pressable>
      {expanded && children ? (
        <View style={styles.body}>
          <View style={styles.divider} />
          <View style={styles.bodyInner}>{children}</View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    position: "relative",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    overflow: "hidden",
  },
  bar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
    padding: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  headerIcons: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  body: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: Surface.border,
    marginBottom: Spacing.three,
  },
  bodyInner: {
    gap: Spacing.three,
  },
});
