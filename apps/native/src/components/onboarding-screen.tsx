import { useCallback, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

import { Text, Title } from "@uoplan/ui";

import { AppIcon, type IconName } from "@/components/app-icon";
import { LoadingScreen } from "@/components/loading-screen";
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
  const [entering, setEntering] = useState(false);

  // Completing onboarding swaps this screen for the full tab navigator, whose
  // first mount briefly blocks the JS thread. Paint a branded loading overlay
  // first (so the tapped button isn't left looking frozen), then defer the gate
  // flip to the next frame so that overlay lands before the heavy mount.
  const enter = useCallback(
    (toPersonalize: boolean) => {
      if (entering) return;
      if (toPersonalize) router.replace(PERSONALIZE_ROUTE);
      setEntering(true);
      requestAnimationFrame(complete);
    },
    [complete, entering, router],
  );

  const personalize = useCallback(() => enter(true), [enter]);
  const skip = useCallback(() => enter(false), [enter]);

  return (
    <View style={styles.fill}>
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
                <View style={styles.featureIcon}>
                  <AppIcon name={feature.icon} size={16} color={Surface.accent} />
                </View>
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
          <PillButton testID="onboarding-skip" variant="secondary" label="Skip" onPress={skip} />
        </View>
      </SafeAreaView>
      {entering ? <LoadingScreen /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
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
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.three,
    paddingVertical: Spacing.one,
  },
  featureIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.accentSoft,
  },
  actions: {
    gap: Spacing.two,
    width: "100%",
    maxWidth: 330,
    alignSelf: "center",
  },
});
