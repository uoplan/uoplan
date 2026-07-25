import { Alert, Anchor, Group, Progress, Stack, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { completedCoursesIncludeFls3500, frenchImmersionOverallVolumePercent } from "@uoplan/core";
import { tr } from "../../i18n";
import { AppCard } from "./AppCard";
import { useFrenchImmersionProgressState } from "./useFrenchImmersionProgressState";
import { useSchool } from "../../hooks/useSchool";

type FrenchImmersionProgramOverviewVariant = "default" | "calendarSidebar" | "compact";

function CheckLine({
  done,
  children,
  dark,
}: {
  done: boolean;
  children: ReactNode;
  dark: boolean;
}) {
  const markColor = done ? (dark ? "teal.4" : "teal.7") : dark ? "gray.5" : "dimmed";
  return (
    <Group gap={8} align="flex-start" wrap="nowrap">
      <Text
        component="span"
        size="xs"
        fw={600}
        c={markColor}
        style={{
          flexShrink: 0,
          width: "1.125rem",
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        {done ? "✓" : "○"}
      </Text>
      <Text
        size="xs"
        c={dark ? "gray.3" : undefined}
        style={{ flex: 1, minWidth: 0, lineHeight: 1.4 }}
      >
        {children}
      </Text>
    </Group>
  );
}

export function FrenchImmersionProgramOverview({
  variant = "default",
}: {
  variant?: FrenchImmersionProgramOverviewVariant;
}) {
  const dark = variant === "calendarSidebar";
  const compact = variant === "compact";
  const school = useSchool();

  const { frenchImmersionStream, completedCourses, progress } = useFrenchImmersionProgressState();

  const overallPct = frenchImmersionOverallVolumePercent(progress);
  const volumeDone = progress.volumeMet;
  const showFls3500Reminder =
    frenchImmersionStream && !completedCoursesIncludeFls3500(completedCourses);

  if (!frenchImmersionStream) return null;

  if (compact) {
    return (
      <Stack gap={6} mt={4}>
        <Group justify="space-between" gap="xs" wrap="nowrap" align="center">
          <Text size="xs" style={{ color: "var(--app-text-muted)" }} lineClamp={2}>
            {tr("frenchImmersion.overview.compactLine", {
              courses: progress.countedCourses,
              reqC: progress.requiredCourses,
              units: progress.countedUnits,
              reqU: progress.requiredUnits,
            })}
          </Text>
          <Text size="xs" ff="monospace" style={{ color: "var(--app-text-muted)", flexShrink: 0 }}>
            {overallPct}%
          </Text>
        </Group>
        <Progress
          value={overallPct}
          size="xs"
          radius="xl"
          color={volumeDone ? "teal" : "accentBlue"}
          aria-label={tr("frenchImmersion.overview.volumeAria")}
        />
      </Stack>
    );
  }

  return (
    <AppCard p="md" shadow="xs">
      <Stack gap="sm">
        <div>
          <Text fw={600} size="sm" c={dark ? "gray.0" : undefined}>
            {tr("frenchImmersion.overview.title")}
          </Text>
          <Text size="xs" c={dark ? "gray.5" : "dimmed"} mt={4}>
            {tr("frenchImmersion.progress.disclaimer")}
          </Text>
          {progress.isNursingProgram && (
            <Text size="xs" c={dark ? "gray.4" : "dimmed"} mt={4}>
              {tr("frenchImmersion.progress.nursing")}
            </Text>
          )}
        </div>

        <div>
          <Group justify="space-between" gap="xs" wrap="nowrap" mb={6}>
            <Text size="xs" fw={600} c={dark ? "gray.5" : "dimmed"}>
              {tr("frenchImmersion.overview.volumeHeading")}
            </Text>
            <Text size="xs" ff="monospace" c={dark ? "gray.4" : "dimmed"}>
              {tr("frenchImmersion.overview.volumeCounts", {
                courses: progress.countedCourses,
                reqC: progress.requiredCourses,
                units: progress.countedUnits,
                reqU: progress.requiredUnits,
              })}
            </Text>
          </Group>
          <Progress
            value={overallPct}
            size="sm"
            radius="xl"
            color={volumeDone ? "teal" : "accentBlue"}
            aria-label={tr("frenchImmersion.overview.volumeAria")}
          />
        </div>

        <Stack gap={3}>
          <CheckLine done={volumeDone} dark={dark}>
            {tr("frenchImmersion.overview.checkVolume")}
          </CheckLine>
          <CheckLine done={progress.min1000NonFlsMet} dark={dark}>
            {tr("frenchImmersion.overview.check1000")}
          </CheckLine>
          <CheckLine done={progress.min3000Or4000NonFlsMet} dark={dark}>
            {tr("frenchImmersion.overview.check3000")}
          </CheckLine>
          <CheckLine done={progress.allAccompanyingFlsCountTowardVolume} dark={dark}>
            {tr("frenchImmersion.overview.checkCompanion")}
          </CheckLine>
        </Stack>

        <Anchor
          href={school.frenchImmersionDiplomaUrl ?? undefined}
          target="_blank"
          rel="noreferrer"
          size="xs"
          c={dark ? "accentBlue.3" : undefined}
        >
          {tr("frenchImmersion.progress.officialLink")}
        </Anchor>

        {showFls3500Reminder && (
          <Alert
            color="yellow"
            variant="light"
            radius="xl"
            title={tr("frenchImmersion.fls3500.title")}
          >
            <Text size="sm">{tr("frenchImmersion.fls3500.body")}</Text>
          </Alert>
        )}
      </Stack>
    </AppCard>
  );
}
