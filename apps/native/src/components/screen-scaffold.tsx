import type { ReactNode } from "react";
import { Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Stack, Text, Title } from "@uoplan/ui";

import { BottomTabInset, MaxContentWidth, Spacing, Surface } from "@/constants/theme";

interface ScreenScaffoldProps {
  /** Large iOS-style title shown at the top of the screen. */
  title: string;
  /** Optional supporting line under the title. */
  subtitle?: string;
  /** Optional element rendered on the trailing side of the header row. */
  headerAccessory?: ReactNode;
  /** Screen body. */
  children: ReactNode;
}

/**
 * Consistent native screen chrome for every tab: a warm-paper background, a
 * large-title header (iOS large-title style, since `NativeTabs` leaf screens
 * have no navigation bar), and a scroll area that clears the safe-area insets
 * and the bottom tab bar. Content is centred + width-capped on large devices.
 */
export function ScreenScaffold({
  title,
  subtitle,
  headerAccessory,
  children,
}: ScreenScaffoldProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { backgroundColor: Surface.page }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + Spacing.three,
            paddingBottom: insets.bottom + BottomTabInset + Spacing.four,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.column}>
          <Stack gap="lg">
            <View style={styles.headerRow}>
              <View style={styles.headerText}>
                <Title order={1}>{title}</Title>
                {subtitle ? (
                  <Text dimmed size="md">
                    {subtitle}
                  </Text>
                ) : null}
              </View>
              {headerAccessory ? <View>{headerAccessory}</View> : null}
            </View>
            {children}
          </Stack>
        </View>
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
  content: {
    flexDirection: "row",
    justifyContent: "center",
    paddingHorizontal: Platform.OS === "web" ? Spacing.four : Spacing.three,
  },
  column: {
    flex: 1,
    maxWidth: MaxContentWidth,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  headerText: {
    flex: 1,
    gap: Spacing.one,
  },
});
