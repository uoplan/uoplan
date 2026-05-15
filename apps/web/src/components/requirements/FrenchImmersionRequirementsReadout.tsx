import { Alert, Anchor, Paper, Stack, Text } from "@mantine/core";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import {
  analyzeFrenchImmersionProgress,
  completedCoursesIncludeFls3500,
  frenchImmersionOverallVolumePercent,
  groupCountedFrenchImmersionCodesByCategory,
  normalizeCourseCode,
  programTitleIndicatesNursing,
} from "schedule";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";

const DIPLOMA_REQUIREMENTS_URL =
  "https://www.uottawa.ca/study/immersion/french/about/diploma-requirements";

function formatCodeList(codes: string[]): string {
  if (codes.length === 0) return "—";
  return [...new Set(codes)].sort().join(", ");
}

export function FrenchImmersionRequirementsReadout() {
  const {
    frenchImmersionStream,
    completedCourses,
    currentSchedule,
    cache,
    program,
    unassignedCompletedCourses,
  } = useAppStore(
    useShallow((s) => ({
      frenchImmersionStream: s.frenchImmersionStream,
      completedCourses: s.completedCourses,
      currentSchedule: s.currentSchedule,
      cache: s.cache,
      program: s.program,
      unassignedCompletedCourses: s.unassignedCompletedCourses,
    })),
  );

  const progress = useMemo(() => {
    const scheduleCodes = currentSchedule?.enrollments.map((e) => e.courseCode) ?? [];
    const merged = [...completedCourses, ...scheduleCodes].map((c) => normalizeCourseCode(c));
    return analyzeFrenchImmersionProgress(merged, cache, {
      isNursingProgram: programTitleIndicatesNursing(program?.title),
    });
  }, [completedCourses, currentSchedule, cache, program?.title]);

  const grouped = useMemo(
    () => groupCountedFrenchImmersionCodesByCategory(progress.countedTowardVolumeCodes),
    [progress.countedTowardVolumeCodes],
  );

  const excludedUnique = useMemo(
    () => [...new Set(progress.excludedCompanionCodes)],
    [progress.excludedCompanionCodes],
  );

  const overallPct = frenchImmersionOverallVolumePercent(progress);
  const showFls3500Reminder =
    frenchImmersionStream && !completedCoursesIncludeFls3500(completedCourses);

  if (!frenchImmersionStream) return null;

  const pendingAssign = unassignedCompletedCourses.length > 0;

  return (
    <Paper withBorder radius={0} p="md" bg="var(--mantine-color-body)">
      <Stack gap="sm">
        <div>
          <Text fw={600} size="sm">
            {tr("frenchImmersion.readout.title")}
          </Text>
          <Text size="xs" c="dimmed" mt={4}>
            {tr("frenchImmersion.readout.intro")}
          </Text>
          {pendingAssign && (
            <Text size="xs" c="dimmed" mt={4}>
              {tr("frenchImmersion.readout.pendingAssign")}
            </Text>
          )}
          {progress.isNursingProgram && (
            <Text size="xs" c="dimmed" mt={4}>
              {tr("frenchImmersion.progress.nursing")}
            </Text>
          )}
        </div>

        <Text size="xs" ff="monospace" c="dimmed">
          {tr("frenchImmersion.overview.volumeCounts", {
            courses: progress.countedCourses,
            reqC: progress.requiredCourses,
            units: progress.countedUnits,
            reqU: progress.requiredUnits,
          })}{" "}
          ({overallPct}%)
        </Text>

        <Stack gap={6}>
          <Text size="xs" c="dimmed">
            <Text span fw={600} c="var(--mantine-color-text)">
              {tr("frenchImmersion.readout.cat1000")}
            </Text>{" "}
            {formatCodeList(grouped.level_1000_non_fls)}
          </Text>
          <Text size="xs" c="dimmed">
            <Text span fw={600} c="var(--mantine-color-text)">
              {tr("frenchImmersion.readout.cat3000")}
            </Text>{" "}
            {formatCodeList(grouped.level_3000_4000_non_fls)}
          </Text>
          <Text size="xs" c="dimmed">
            <Text span fw={600} c="var(--mantine-color-text)">
              {tr("frenchImmersion.readout.catCompanion")}
            </Text>{" "}
            {formatCodeList(grouped.accompanying_fls)}
          </Text>
          {grouped.other_french.length > 0 && (
            <Text size="xs" c="dimmed">
              <Text span fw={600} c="var(--mantine-color-text)">
                {tr("frenchImmersion.readout.catOther")}
              </Text>{" "}
              {formatCodeList(grouped.other_french)}
            </Text>
          )}
        </Stack>

        {excludedUnique.length > 0 && (
          <Text size="xs" c="yellow.8">
            <Text span fw={600}>
              {tr("frenchImmersion.readout.excludedLabel")}
            </Text>{" "}
            {formatCodeList(excludedUnique)}. {tr("frenchImmersion.progress.excludedCompanionsHint")}
          </Text>
        )}

        <Anchor href={DIPLOMA_REQUIREMENTS_URL} target="_blank" rel="noreferrer" size="xs">
          {tr("frenchImmersion.progress.officialLink")}
        </Anchor>

        {showFls3500Reminder && (
          <Alert color="yellow" variant="light" radius={0} title={tr("frenchImmersion.fls3500.title")}>
            <Text size="sm">{tr("frenchImmersion.fls3500.body")}</Text>
          </Alert>
        )}
      </Stack>
    </Paper>
  );
}
