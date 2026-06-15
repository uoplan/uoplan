import { useCallback } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, Title } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { PillButton } from "@/components/redesign/pill-button";
import { Spacing, Surface } from "@/constants/theme";
import { useOnboarding } from "@/data/onboarding-provider";

const LOGO = require("../../assets/images/party-logo.png");

export const PERSONALIZE_ROUTE = "/personalize";

const FEATURES: readonly { label: string; icon: IconName }[] = [
  { label: "Pick a term", icon: "calendar" },
  { label: "Choose a program", icon: "person.crop.circle" },
  { label: "Build better schedules", icon: "sparkles" },
];

export function OnboardingScreen() {
  const router = useRouter();
  const { complete } = useOnboarding();

  const personalize = useCallback(() => {
    router.replace(PERSONALIZE_ROUTE);
    complete();
  }, [complete, router]);

  return (
    <SafeAreaView style={styles.root} testID="onboarding-screen">
      <View style={styles.content}>
        <View style={styles.logoFrame}>
          <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        </View>

        <View style={styles.copy}>
          <Text size="sm" weight="bold" color={Surface.accent} align="center">
            Welcome to uoplan
          </Text>
          <Title order={1}>Set up your planner</Title>
          <Text dimmed align="center">
            Tell uoplan what you study once, then the schedule tab starts with a clear plan.
          </Text>
        </View>

        <View style={styles.features} accessibilityLabel="Setup highlights">
          {FEATURES.map((feature) => (
            <View key={feature.label} style={styles.feature}>
              <AppIcon name={feature.icon} size={16} color={Surface.accent} />
              <Text size="sm" weight="medium">
                {feature.label}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actions}>
        <PillButton
          testID="onboarding-personalize"
          variant="primary"
          label="Personalize"
          onPress={personalize}
        />
        <PillButton testID="onboarding-skip" variant="secondary" label="Skip" onPress={complete} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
    backgroundColor: Surface.page,
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.four,
  },
  logoFrame: {
    width: 96,
    height: 96,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  logo: {
    width: 66,
    height: 66,
  },
  copy: {
    alignItems: "center",
    gap: Spacing.two,
    maxWidth: 330,
  },
  features: {
    width: "100%",
    maxWidth: 330,
    gap: Spacing.two,
  },
  feature: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: Surface.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  actions: {
    gap: Spacing.two,
    width: "100%",
    maxWidth: 330,
    alignSelf: "center",
  },
});
