import type { ReactNode } from "react";
import { Pressable, StyleSheet, View, type ViewStyle } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";

/** Pastel tones for {@link IconTile}, mirroring the web mobile icon chips. */
export type TileTone = "blue" | "green" | "amber" | "violet" | "neutral";

const TILE_TONES: Record<TileTone, { bg: string; fg: string }> = {
  blue: { bg: "#e4eefd", fg: "#3673cb" },
  green: { bg: "#e3f2e7", fg: "#318c4c" },
  amber: { bg: "#f6ecdd", fg: "#bd7221" },
  violet: { bg: "#ece6f7", fg: "#7a59c3" },
  neutral: { bg: Surface.subtle, fg: Surface.label },
};

interface IconTileProps {
  icon: IconName;
  tone?: TileTone;
  size?: number;
}

/** A soft, pastel-tinted square holding a single SF Symbol — the signature
 *  web-mobile "feature" glyph tile (blue=schedule, green=explore, amber=trends). */
export function IconTile({ icon, tone = "blue", size = 44 }: IconTileProps) {
  const { bg, fg } = TILE_TONES[tone];
  return (
    <View style={[styles.tile, { width: size, height: size, backgroundColor: bg }]}>
      <AppIcon name={icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}

interface SectionCardProps {
  /** Optional card heading (rendered in the serif/mono title style). */
  title?: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /** When set, a trailing "→" affordance is shown and the header is pressable. */
  onPressHeader?: () => void;
  /** Draw a coloured accent bar down the leading edge (active step state). */
  accentBar?: boolean;
  /** Override the card padding. */
  padding?: number;
  style?: ViewStyle;
  children?: ReactNode;
}

/**
 * The core surface of the redesigned native app: a warm-paper card with a 1px
 * hairline border and an 18px radius, optionally headed by a title + "see all"
 * arrow link and/or a leading accent bar. Matches the web mobile section cards.
 */
export function SectionCard({
  title,
  subtitle,
  onPressHeader,
  accentBar,
  padding = Spacing.three,
  style,
  children,
}: SectionCardProps) {
  return (
    <View style={[styles.card, style]}>
      {accentBar ? <View style={styles.accentBar} /> : null}
      <View style={{ padding }}>
        {title ? (
          <Pressable
            disabled={!onPressHeader}
            onPress={onPressHeader}
            accessibilityRole={onPressHeader ? "button" : "header"}
            style={styles.header}
          >
            <View style={styles.headerText}>
              <Text size="lg" weight="bold">
                {title}
              </Text>
              {subtitle ? (
                <Text size="sm" dimmed>
                  {subtitle}
                </Text>
              ) : null}
            </View>
            {onPressHeader ? <AppIcon name="arrow.right" size={18} color={Surface.dimmed} /> : null}
          </Pressable>
        ) : null}
        {children}
      </View>
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
  accentBar: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: Surface.accent,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.two,
    marginBottom: Spacing.two,
  },
  headerText: {
    flex: 1,
    gap: 2,
  },
  tile: {
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
});
