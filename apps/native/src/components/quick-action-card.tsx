import { Pressable, StyleSheet, View } from "react-native";

import { Stack, Text, Title } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";

interface QuickActionCardProps {
  title: string;
  description: string;
  /** Optional leading SF Symbol rendered in an accent chip. */
  icon?: IconName;
  onPress?: () => void;
}

/**
 * A tappable destination card used in the Home/Explore grids. Built as a single
 * pressable surface (rather than a Card + inner Button) so the whole tile is the
 * touch target — the expected native interaction.
 */
export function QuickActionCard({ title, description, icon, onPress }: QuickActionCardProps) {
  return (
    <Pressable
      onPress={onPress}
      android_ripple={{ color: Surface.subtle }}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <Stack gap="xs">
        {icon ? (
          <View style={styles.chip}>
            <AppIcon name={icon} size={20} color={Surface.accent} />
          </View>
        ) : null}
        <Title order={4}>{title}</Title>
        <Text size="sm" dimmed>
          {description}
        </Text>
      </Stack>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    padding: Spacing.three,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.card,
    minHeight: 132,
  },
  pressed: {
    backgroundColor: Surface.subtle,
  },
  chip: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.subtle,
    marginBottom: Spacing.one,
  },
});
