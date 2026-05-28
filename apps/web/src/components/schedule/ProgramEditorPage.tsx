import { Stack } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { useAppStore } from "../../store/appStore";
import { tr } from "../../i18n";
import { ProgramStep } from "../steps/ProgramStep";
import { ScheduleEditorShell } from "./ScheduleEditorShell";

export function ProgramEditorPage() {
  useLingui();
  const catalogue = useAppStore((s) => s.catalogue);
  const program = useAppStore((s) => s.program);
  const setProgram = useAppStore((s) => s.setProgram);

  const programs = catalogue?.programs ?? [];

  return (
    <ScheduleEditorShell
      step="program"
      title={tr("schedule.editor.program.title")}
      subtitle={tr("schedule.editor.program.subtitle")}
    >
      <Stack gap="md">
        <ProgramStep programs={programs} value={program?.url ?? null} onChange={setProgram} />
      </Stack>
    </ScheduleEditorShell>
  );
}
