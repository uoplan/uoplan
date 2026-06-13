import { useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";

import { Button, Paper, SimpleGrid, Stack, Text, Title } from "@uoplan/ui";

import { QuickActionCard } from "@/components/quick-action-card";
import { ScreenScaffold } from "@/components/screen-scaffold";
import { Spacing, Surface } from "@/constants/theme";

/**
 * Home tab — the product landing for the native app. A hero with the primary
 * "build my schedule" call-to-action, followed by a grid of quick-action tiles
 * that jump to the other tabs. Navigation uses Expo Router directly (these are
 * platform shell screens); the shared write-once screens in `@uoplan/app` use
 * the `@uoplan/navigation` contract instead.
 */
export default function HomeScreen() {
  const router = useRouter();

  return (
    <ScreenScaffold title="uoplan" subtitle="Requirement-first course planning for uOttawa">
      <Paper p="lg" radius="lg" withBorder shadow="sm">
        <Stack gap="md">
          <View style={styles.heroAccent} />
          <Stack gap="xs">
            <Title order={2}>Plan your degree, one term at a time</Title>
            <Text dimmed>
              Turn your program requirements into conflict-free weekly timetables — pick a term, add
              your completed courses, and let uoplan do the rest.
            </Text>
          </Stack>
          <Button variant="filled" fullWidth onPress={() => router.push("/schedule")}>
            Build my schedule
          </Button>
        </Stack>
      </Paper>

      <Stack gap="sm">
        <Title order={3}>Jump back in</Title>
        <SimpleGrid cols={2} spacing="md">
          <QuickActionCard
            icon="magnifyingglass"
            title="Explore"
            description="Programs, courses, disciplines and professors."
            onPress={() => router.push("/explore")}
          />
          <QuickActionCard
            icon="calendar"
            title="Schedule"
            description="View and tweak your weekly calendar."
            onPress={() => router.push("/schedule")}
          />
          <QuickActionCard
            icon="chart.bar.fill"
            title="Trends"
            description="Historical grade distributions."
            onPress={() => router.push("/trends")}
          />
          <QuickActionCard
            icon="gearshape.fill"
            title="More"
            description="Settings, about, and developer tools."
            onPress={() => router.push("/more")}
          />
        </SimpleGrid>
      </Stack>

      <Paper p="md" radius="lg" withBorder>
        <Stack gap="xs">
          <Text size="sm" weight="semibold">
            Always up to date
          </Text>
          <Text size="sm" dimmed>
            Course and grade data is fetched live and cached on your device, so the app keeps
            working offline after the first load.
          </Text>
        </Stack>
      </Paper>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  heroAccent: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: Surface.accent,
    marginBottom: Spacing.one,
  },
});
