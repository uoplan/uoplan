import { Alert, Anchor, Card, Group, Progress, Stack, Text } from "@mantine/core";
import { useMemo, type ReactNode } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  analyzeFrenchImmersionProgress,
  completedCoursesIncludeFls3500,
  frenchImmersionOverallVolumePercent,
  normalizeCourseCode,
  programTitleIndicatesNursing,
} from "@uoplan/schedule";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";

const DIPLOMA_REQUIREMENTS_URL =
  "https://www.uottawa.ca/study/immersion/french/about/diploma-requirements";

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

  const { frenchImmersionStream, completedCourses, currentSchedule, cache, program } = useAppStore(
    useShallow((s) => ({
      frenchImmersionStream: s.frenchImmersionStream,
      completedCourses: s.completedCourses,
      currentSchedule: s.currentSchedule,
      cache: s.cache,
      program: s.program,
    })),
  );

  const progress = useMemo(() => {
    const scheduleCodes = currentSchedule?.enrollments.map((e) => e.courseCode) ?? [];
    const merged = [...completedCourses, ...scheduleCodes].map((c) => normalizeCourseCode(c));
    return analyzeFrenchImmersionProgress(merged, cache, {
      isNursingProgram: programTitleIndicatesNursing(program?.title),
    });
  }, [completedCourses, currentSchedule, cache, program?.title]);

  const overallPct = frenchImmersionOverallVolumePercent(progress);
  const volumeDone = progress.volumeMet;
  const showFls3500Reminder =
    frenchImmersionStream && !completedCoursesIncludeFls3500(completedCourses);

  if (!frenchImmersionStream) return null;

  if (compact) {
    return (
      <Stack gap={6} mt={4}>
        <Group justify="space-between" gap="xs" wrap="nowrap" align="center">
          <Text size="xs" style={{ color: "#CED4DA" }} lineClamp={2}>
            {tr("frenchImmersion.overview.compactLine", {
              courses: progress.countedCourses,
              reqC: progress.requiredCourses,
              units: progress.countedUnits,
              reqU: progress.requiredUnits,
            })}
          </Text>
          <Text size="xs" ff="monospace" style={{ color: "#ADB5BD", flexShrink: 0 }}>
            {overallPct}%
          </Text>
        </Group>
        <Progress
          value={overallPct}
          size="xs"
          radius={0}
          color={volumeDone ? "teal" : "violet"}
          aria-label={tr("frenchImmersion.overview.volumeAria")}
        />
      </Stack>
    );
  }

  return (
    <Card
      padding="md"
      radius={0}
      shadow="xs"
      styles={{
        root: dark
          ? {
              backgroundColor: "#1A1B1E",
              border: "none",
            }
          : {
              border: "none",
            },
      }}
    >
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
            <Text size="xs" fw={600} tt="uppercase" c={dark ? "gray.5" : "dimmed"}>
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
            radius={0}
            color={volumeDone ? "teal" : "violet"}
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
          href={DIPLOMA_REQUIREMENTS_URL}
          target="_blank"
          rel="noreferrer"
          size="xs"
          c={dark ? "violet.3" : undefined}
        >
          {tr("frenchImmersion.progress.officialLink")}
        </Anchor>

        {showFls3500Reminder && (
          <Alert
            color="yellow"
            variant="light"
            radius={0}
            title={tr("frenchImmersion.fls3500.title")}
          >
            <Text size="sm">{tr("frenchImmersion.fls3500.body")}</Text>
          </Alert>
        )}
      </Stack>
    </Card>
  );
}
