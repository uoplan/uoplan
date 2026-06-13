import { Pressable, StyleSheet, View } from "react-native";

import { Text } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";

interface ListRowProps {
  title: string;
  description?: string;
  /** Optional leading SF Symbol. */
  icon?: IconName;
  /** Show a trailing chevron. Defaults to true. */
  chevron?: boolean;
  onPress?: () => void;
}

/**
 * A tappable settings/navigation row in the iOS grouped-list idiom: optional
 * leading icon, a title + optional description, and a trailing chevron. Used by
 * the More tab and other list surfaces.
 */
export function ListRow({ title, description, icon, chevron = true, onPress }: ListRowProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: Surface.subtle }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      {icon ? (
        <View style={styles.leading}>
          <AppIcon name={icon} size={20} color={Surface.accent} />
        </View>
      ) : null}
      <View style={styles.body}>
        <Text size="md" weight="medium">
          {title}
        </Text>
        {description ? (
          <Text size="sm" dimmed>
            {description}
          </Text>
        ) : null}
      </View>
      {chevron ? <AppIcon name="chevron.right" size={14} color={Surface.dimmed} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three,
    backgroundColor: Surface.card,
  },
  pressed: {
    backgroundColor: Surface.subtle,
  },
  leading: {
    width: 28,
    alignItems: "center",
  },
  body: {
    flex: 1,
    gap: 2,
  },
});
