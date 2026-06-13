import { useShallow } from "zustand/react/shallow";
import { useAppStore } from "../appStore";

/**
 * Program/minor/student-program selection plus the French-immersion stream toggle,
 * with their setters. The `frenchImmersionStream` flag lives here (a program-level
 * choice) rather than with the generation options.
 */
export function useProgramSelection() {
  const reads = useAppStore(
    useShallow((s) => ({
      program: s.program,
      minorProgram: s.minorProgram,
      studentPrograms: s.studentPrograms,
      frenchImmersionStream: s.frenchImmersionStream,
    })),
  );

  const setProgram = useAppStore((s) => s.setProgram);
  const setMinorProgram = useAppStore((s) => s.setMinorProgram);
  const setStudentPrograms = useAppStore((s) => s.setStudentPrograms);
  const setFrenchImmersionStream = useAppStore((s) => s.setFrenchImmersionStream);

  return {
    ...reads,
    setProgram,
    setMinorProgram,
    setStudentPrograms,
    setFrenchImmersionStream,
  };
}

/** The active program, or null. Cheap single-field read for `hasProgram`-style gates. */
export function useActiveProgram() {
  return useAppStore((s) => s.program);
}
