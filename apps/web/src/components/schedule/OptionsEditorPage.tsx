import { Stack } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";
import { OptionsStep } from "../requirements/OptionsStep";
import { ScheduleEditorShell } from "./ScheduleEditorShell";

export function OptionsEditorPage() {
  useLingui();
  const requirementTreeWithStatus = useAppStore((s) => s.requirementTreeWithStatus);
  const completedCourses = useAppStore((s) => s.completedCourses);
  const selectedOptionsPerRequirement = useAppStore((s) => s.selectedOptionsPerRequirement);
  const setSelectedOptionForRequirement = useAppStore((s) => s.setSelectedOptionForRequirement);
  const clearSelectedOptionForRequirement = useAppStore((s) => s.clearSelectedOptionForRequirement);

  return (
    <ScheduleEditorShell
      step="options"
      title={tr("schedule.editor.options.title")}
      subtitle={tr("schedule.editor.options.subtitle")}
    >
      <Stack gap="md">
        <OptionsStep
          requirementTreeWithStatus={requirementTreeWithStatus}
          completedCourses={completedCourses}
          selectedOptionsPerRequirement={selectedOptionsPerRequirement}
          onSelectOption={setSelectedOptionForRequirement}
          onClearOption={clearSelectedOptionForRequirement}
        />
      </Stack>
    </ScheduleEditorShell>
  );
}
