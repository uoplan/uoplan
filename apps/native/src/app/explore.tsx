import * as Device from "expo-device";
import { Platform, StyleSheet } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { resolveTheme, THEME_LIST } from "@uoplan/theme";
import { Button } from "@uoplan/ui";

import { AnimatedIcon } from "@/components/animated-icon";
import { HintRow } from "@/components/hint-row";
import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { WebBadge } from "@/components/web-badge";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";

function getDevMenuHint() {
  if (Platform.OS === "web") {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === "android" ? "cmd+m (or ctrl+m)" : "cmd+d";
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

// Spike proof: this data comes from the shared, platform-agnostic
// `@uoplan/theme` workspace package (also consumed by apps/web). If it renders
// here, Metro resolves + transpiles raw-TS monorepo packages on-device and the
// shared theme logic runs unchanged under React Native.
const activeTheme = resolveTheme("system", "dark");
const sharedThemeIds = THEME_LIST.map((theme) => theme.id).join(", ");

export default function DiagnosticsScreen() {
  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            uoplan&nbsp;native
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          shared core wired
        </ThemedText>

        <ThemedView type="backgroundElement" style={styles.stepContainer}>
          <HintRow
            title="@uoplan/theme"
            hint={<ThemedText type="small">resolved from workspace ✓</ThemedText>}
          />
          <HintRow title="Themes" hint={<ThemedText type="code">{sharedThemeIds}</ThemedText>} />
          <HintRow
            title="resolveTheme(system, dark)"
            hint={<ThemedText type="code">{activeTheme.id}</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
        </ThemedView>

        <Button
          testID="contract-button"
          fullWidth
          onPress={() => {
            console.log("shared @uoplan/ui Button pressed (native variant)");
          }}
        >
          shared @uoplan/ui button
        </Button>

        {Platform.OS === "web" && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    flexDirection: "row",
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    alignItems: "center",
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  heroSection: {
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.four,
  },
  title: {
    textAlign: "center",
  },
  code: {
    textTransform: "uppercase",
  },
  stepContainer: {
    gap: Spacing.three,
    alignSelf: "stretch",
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.four,
    borderRadius: Spacing.four,
  },
});
