import { Divider, Stack, Text } from "@mantine/core";
import {
  useCompletedCourses,
  useDataset,
  useProgramSelection,
  useRequirementState,
} from "../../store/hooks";
import { tr, useTr } from "../../i18n";
import { useAnalytics } from "../../lib/analytics";
import { ProgramStep } from "../steps/ProgramStep";
import { CompletedCoursesStep } from "../steps/CompletedCoursesStep";

export function ProgramCoursesPanel() {
  useTr();
  const { catalogue, cache } = useDataset();
  const { program, setProgram } = useProgramSelection();
  const { remainingRequirements } = useRequirementState();
  const { completedCourses, setCompletedCourses } = useCompletedCourses();
  const analytics = useAnalytics();

  const programs = catalogue?.programs ?? [];
  const hasProgram = !!program;

  return (
    <Stack gap="lg" p="lg">
      <ProgramStep
        programs={programs}
        value={program?.url ?? null}
        onChange={(nextProgram) => {
          setProgram(nextProgram);
          if (nextProgram) {
            analytics.capture("program_selected", { programId: nextProgram.url });
          }
        }}
      />

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
            onChange={(courses) => {
              setCompletedCourses(courses);
              analytics.capture("completed_courses_updated", {
                count: courses.length,
                source: "manual",
              });
            }}
            hasProgram={hasProgram}
          />
        </>
      ) : null}
    </Stack>
  );
}
