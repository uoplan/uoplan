import { Divider, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";
import { ProgramStep } from "../steps/ProgramStep";
import { CompletedCoursesStep } from "../steps/CompletedCoursesStep";

export function ProgramCoursesPanel() {
  useLingui();
  const catalogue = useAppStore((s) => s.catalogue);
  const program = useAppStore((s) => s.program);
  const setProgram = useAppStore((s) => s.setProgram);
  const cache = useAppStore((s) => s.cache);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const setCompletedCourses = useAppStore((s) => s.setCompletedCourses);

  const programs = catalogue?.programs ?? [];
  const hasProgram = !!program;

  return (
    <Stack gap="lg" p="lg">
      <ProgramStep programs={programs} value={program?.url ?? null} onChange={setProgram} />

      {hasProgram ? (
        <>
          <Divider color="var(--app-border)" />
          <Stack gap={4}>
            <Text size="sm" fw={600} c="var(--app-text)">
              {tr("schedule.programCourses.completedHeading")}
            </Text>
            <Text size="xs" c="var(--app-text-muted)" lh={1.5}>
              {tr("schedule.programCourses.completedHint")}
            </Text>
          </Stack>
          <CompletedCoursesStep
            cache={cache}
            remainingRequirements={remainingRequirements}
            completedCourses={completedCourses}
            onChange={setCompletedCourses}
            hasProgram={hasProgram}
          />
        </>
      ) : null}
    </Stack>
  );
}
