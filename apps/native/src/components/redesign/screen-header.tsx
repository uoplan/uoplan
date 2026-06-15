import { StyleSheet, View } from "react-native";

import { Text, Title } from "@uoplan/ui";

import { Spacing } from "@/constants/theme";

interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
}

/**
 * The in-flow page heading: a large serif title and an optional muted subtitle,
 * rendered as the first scroll child of `RedesignScreen`. The header *chrome*
 * (back arrow + `[cart][settings]` cluster) is no longer part of this component —
 * it lives in `RedesignScreen`'s sticky top bar so the glass buttons stay pinned
 * while this title scrolls underneath.
 */
export function ScreenHeader({ title, subtitle }: ScreenHeaderProps) {
  return (
    <View style={styles.titleText}>
      <Title order={1}>{title}</Title>
      {subtitle ? (
        <Text dimmed size="md">
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  titleText: {
    gap: Spacing.one,
  },
});
