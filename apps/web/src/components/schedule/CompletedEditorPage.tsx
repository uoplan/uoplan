import { Stack } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";
import { CompletedCoursesStep } from "../steps/CompletedCoursesStep";
import { ScheduleEditorShell } from "./ScheduleEditorShell";

export function CompletedEditorPage() {
  useLingui();
  const cache = useAppStore((s) => s.cache);
  const remainingRequirements = useAppStore((s) => s.remainingRequirements);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const program = useAppStore((s) => s.program);
  const setCompletedCourses = useAppStore((s) => s.setCompletedCourses);

  return (
    <ScheduleEditorShell
      step="completed"
      title={tr("schedule.editor.completed.title")}
      subtitle={tr("schedule.editor.completed.subtitle")}
    >
      <Stack gap="md">
        <CompletedCoursesStep
          cache={cache}
          remainingRequirements={remainingRequirements}
          completedCourses={completedCourses}
          onChange={setCompletedCourses}
          hasProgram={!!program}
        />
      </Stack>
    </ScheduleEditorShell>
  );
}
