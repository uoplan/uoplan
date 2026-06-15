import { StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";

const ICON_BY_KIND: Record<"rmp" | "satisfaction", IconName> = {
  rmp: "star.fill",
  satisfaction: "bubble.left.fill",
};

/**
 * Compact rating chip — the native leaf of the web `RatingBadge`: an icon
 * (★ RateMyProfessors / 💬 course-feedback satisfaction) + an `x.x` value on a
 * 1-5 scale. Renders nothing when there is no value, mirroring the web cards
 * which only surface a badge when the metric exists.
 */
export function RatingBadge({
  kind,
  value,
}: {
  kind: "rmp" | "satisfaction";
  value: number | null | undefined;
}) {
  if (value == null || !Number.isFinite(value) || value <= 0) return null;
  return (
    <View style={styles.badge}>
      <AppIcon name={ICON_BY_KIND[kind]} size={11} color={Surface.dimmed} />
      <Text size="xs" weight="bold" color={Surface.label}>
        {value.toFixed(1)}
      </Text>
    </View>
  );
}

/** Horizontal row of rating badges (satisfaction · rmp) with a thin separator. */
export function RatingBadgeRow({
  satisfaction,
  rmp,
}: {
  satisfaction?: number | null;
  rmp?: number | null;
}) {
  const showSat = satisfaction != null && Number.isFinite(satisfaction) && satisfaction > 0;
  const showRmp = rmp != null && Number.isFinite(rmp) && rmp > 0;
  if (!showSat && !showRmp) return null;
  return (
    <View style={styles.row}>
      {showSat ? <RatingBadge kind="satisfaction" value={satisfaction} /> : null}
      {showSat && showRmp ? (
        <Text size="xs" color={Surface.faint}>
          ·
        </Text>
      ) : null}
      {showRmp ? <RatingBadge kind="rmp" value={rmp} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
});
