import { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";

import { Button, Divider, Paper, Stack, Switch, Text, Title } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { NotificationToggle } from "@/components/notification-toggle";
import { ScreenScaffold } from "@/components/screen-scaffold";
import { WeekCalendar } from "@/components/week-calendar";
import { Surface } from "@/constants/theme";
import { SAMPLE_SCHEDULE } from "@/data/sample-schedule";
import { exportScheduleIcs } from "@/lib/share-ics";

const WEBSITE = "https://uoplan.party";

/**
 * Schedule tab — the weekly timetable home. Renders a sample conflict-free week
 * in the native {@link WeekCalendar} (shared `@uoplan/calendar` layout math)
 * until the native schedule engine + live data land, plus an editable preview of
 * the generation preferences so the surface feels real.
 */
export default function ScheduleScreen() {
  const [avoidMornings, setAvoidMornings] = useState(true);
  const [avoidEvenings, setAvoidEvenings] = useState(false);
  const [fridaysOff, setFridaysOff] = useState(true);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportScheduleIcs({
        events: SAMPLE_SCHEDULE,
        startDate: "2025-09-03",
        endDate: "2025-12-05",
      });
    } catch {
      // User dismissed the share sheet, or export failed — nothing to surface.
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScreenScaffold title="Schedule" subtitle="Your conflict-free weekly timetable">
      <Paper p="md" radius="lg" withBorder shadow="sm">
        <Stack gap="sm">
          <View style={styles.cardHeader}>
            <View>
              <Title order={4}>Sample week</Title>
              <Text size="sm" dimmed>
                A conflict-free first-year timetable
              </Text>
            </View>
            <View style={styles.termBadge}>
              <AppIcon name="calendar" size={14} color={Surface.accent} />
              <Text size="xs" weight="semibold" color={Surface.label}>
                Fall 2025
              </Text>
            </View>
          </View>
          <Divider my="xs" />
          <WeekCalendar events={SAMPLE_SCHEDULE} />
          <Button
            variant="default"
            fullWidth
            disabled={exporting}
            onPress={() => void handleExport()}
          >
            {exporting ? "Exporting…" : "Export to calendar (.ics)"}
          </Button>
        </Stack>
      </Paper>

      <Paper p="md" radius="lg" withBorder>
        <Stack gap="xs" align="center">
          <Text size="sm" dimmed align="center">
            Pick your term, program and completed courses to generate timetables that satisfy your
            requirements.
          </Text>
          <Button
            variant="filled"
            fullWidth
            onPress={() => void Linking.openURL(`${WEBSITE}/personalize`)}
          >
            Build my schedule
          </Button>
        </Stack>
      </Paper>

      <Paper p="md" radius="lg" withBorder>
        <Stack gap="sm">
          <Title order={4}>Preferences</Title>
          <Text size="sm" dimmed>
            These shape how schedules are generated.
          </Text>
          <Divider my="xs" />
          <Switch
            label="Avoid early mornings"
            checked={avoidMornings}
            onChange={setAvoidMornings}
          />
          <Switch
            label="Avoid evening classes"
            checked={avoidEvenings}
            onChange={setAvoidEvenings}
          />
          <Switch label="Keep Fridays free" checked={fridaysOff} onChange={setFridaysOff} />
          <Divider my="xs" />
          <NotificationToggle />
        </Stack>
      </Paper>
    </ScreenScaffold>
  );
}

const styles = StyleSheet.create({
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  termBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: Surface.subtle,
  },
});
