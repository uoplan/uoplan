interface DisciplineLevelFixture {
  discipline: string;
  levels?: number[];
}

export function canonicalizeDisciplineLevels(
  disciplineLevels: readonly DisciplineLevelFixture[] | undefined,
): Array<{ discipline: string; levels: number[] | undefined }> | undefined {
  if (!disciplineLevels?.length) return undefined;
  return disciplineLevels
    .map((d) => ({
      discipline: d.discipline,
      levels: d.levels ? [...d.levels].sort((a, b) => a - b) : undefined,
    }))
    .sort((a, b) => a.discipline.localeCompare(b.discipline));
}
