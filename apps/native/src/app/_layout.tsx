import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from "expo-router";
import { useState } from "react";
import { useColorScheme, View } from "react-native";

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { LoadingErrorScreen, LoadingScreen } from "@/components/loading-screen";
import { OnboardingScreen } from "@/components/onboarding-screen";
import { Surface } from "@/constants/theme";
import { BasketProvider } from "@/data/basket-provider";
import { CompletedCoursesProvider } from "@/data/completed-courses-provider";
import { CompareProvider } from "@/data/compare-provider";
import { AppDataProvider, useAppDataState } from "@/data/data-provider";
import { OnboardingProvider, useOnboarding } from "@/data/onboarding-provider";
import { ScheduleOptionsProvider } from "@/data/schedule-options-provider";
import { LocaleProvider } from "@/i18n/locale-provider";
import { AnalyticsProvider } from "@/lib/analytics";

/**
 * The app's root navigator: a Stack whose first screen is the `(tabs)` group
 * (Explore / Schedule / Trends bottom tabs) plus `/more`, which is pushed OVER
 * the tab bar as a settings flow rather than being a tab itself. Keeping `more`
 * as a root Stack screen is what lets the global settings button reach it from
 * any tab.
 */
function RootStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Surface.page },
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="more" />
    </Stack>
  );
}

/**
 * Gates the app behind the data load: shows the pulsating-logo loading screen
 * until every `.pb` asset is fetched + decoded and the explore index is built,
 * then renders the navigator. Screens call `useAppData()` (which throws before
 * the load finishes), so the Stack only mounts once `status === "ready"`; the
 * loading overlay then cross-fades out (logo drifting up) over the already-
 * mounted app instead of hard-cutting in. Errors surface a retry screen.
 */
function DataGate() {
  const { state, reload } = useAppDataState();
  const { completed: onboardingCompleted, loading: onboardingLoading } = useOnboarding();
  const [overlayGone, setOverlayGone] = useState(false);

  if (state.status === "error") return <LoadingErrorScreen onRetry={reload} />;

  const dataReady = state.status === "ready";
  const ready = dataReady && !onboardingLoading;
  return (
    <View style={{ flex: 1 }}>
      {ready && onboardingCompleted ? <RootStack /> : null}
      {ready && !onboardingCompleted ? <OnboardingScreen /> : null}
      {!overlayGone ? (
        <LoadingScreen exiting={ready} onExitComplete={() => setOverlayGone(true)} />
      ) : null}
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  // Load the web app's signature type families (DM Serif Display for display
  // headings, DM Mono for body/UI) so the native shell matches the web look.
  const [fontsLoaded] = useFonts({
    "DM Mono": require("../../assets/fonts/DMMono-Regular.ttf"),
    "DM Mono Medium": require("../../assets/fonts/DMMono-Medium.ttf"),
    "DM Serif Display": require("../../assets/fonts/DMSerifDisplay-Regular.ttf"),
  });

  if (!fontsLoaded) return null;

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <AnalyticsProvider>
        <LocaleProvider>
          <AnimatedSplashOverlay />
          <AppDataProvider>
            <CompareProvider>
              <BasketProvider>
                <CompletedCoursesProvider>
                  <ScheduleOptionsProvider>
                    <OnboardingProvider>
                      <DataGate />
                    </OnboardingProvider>
                  </ScheduleOptionsProvider>
                </CompletedCoursesProvider>
              </BasketProvider>
            </CompareProvider>
          </AppDataProvider>
        </LocaleProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}
