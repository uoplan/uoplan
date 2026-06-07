import { Alert, MultiSelect, Text, Stack, Group, ActionIcon } from "@mantine/core";
import { IconMinus, IconPlus } from "@tabler/icons-react";
import {
  createCourseOptions,
  createCourseOptionsFilter,
  renderCourseOption,
} from "../shared/CourseSelect";
import type { DataCache } from "@uoplan/core";
import type { RemainingRequirement } from "@uoplan/core";
import { isRepeatableCourse, formatCourseWithTitle } from "@uoplan/core";
import { tr } from "../../i18n";

interface CompletedCoursesStepProps {
  cache: DataCache | null;
  remainingRequirements: RemainingRequirement[];
  completedCourses: string[];
  onChange: (courses: string[]) => void;
  hasProgram: boolean;
}

export function CompletedCoursesStep({
  cache,
  remainingRequirements,
  completedCourses,
  onChange,
  hasProgram,
}: CompletedCoursesStepProps) {
  const allCandidates = [...new Set(remainingRequirements.flatMap((r) => r.candidateCourses))];

  // Repeatable courses (e.g. accompanying FLS companions) are handled by a separate
  // stepper UI so each instance can be added independently — a MultiSelect cannot
  // represent the same value more than once.
  const repeatableCompleted = completedCourses.filter((c) => isRepeatableCourse(c));
  const nonRepeatableCompleted = completedCourses.filter((c) => !isRepeatableCourse(c));
  const completedNonRepeatableSet = new Set(nonRepeatableCompleted);
  const completedRepeatableSet = new Set(repeatableCompleted);
  const availableCandidates = allCandidates.filter(
    (c) => !completedNonRepeatableSet.has(c) && !completedRepeatableSet.has(c),
  );
  const options = createCourseOptions(availableCandidates, cache);

  const repeatableCodes = [...new Set(repeatableCompleted)].sort();
  const repeatableCounts = new Map<string, number>();
  for (const code of repeatableCompleted) {
    repeatableCounts.set(code, (repeatableCounts.get(code) ?? 0) + 1);
  }

  const handleMultiSelectChange = (next: string[]) => {
    // Preserve repeatable instances, which the MultiSelect does not manage.
    onChange([...next, ...repeatableCompleted]);
  };

  const addRepeatable = (code: string) => {
    onChange([...completedCourses, code]);
  };

  const removeRepeatable = (code: string) => {
    const idx = completedCourses.indexOf(code);
    if (idx === -1) return;
    onChange([...completedCourses.slice(0, idx), ...completedCourses.slice(idx + 1)]);
  };

  if (!hasProgram) {
    return (
      <Alert color="blue" variant="light" radius="md">
        <Text size="sm">{tr("completedCourses.selectProgramFirst")}</Text>
      </Alert>
    );
  }

  return (
    <Stack gap="md">
      <MultiSelect
        data-tour="completed-courses"
        label={tr("completedCourses.label")}
        placeholder={tr("completedCourses.placeholder")}
        data={options}
        value={nonRepeatableCompleted}
        onChange={handleMultiSelectChange}
        searchable
        clearable
        renderOption={renderCourseOption(cache)}
        filter={createCourseOptionsFilter(cache)}
        nothingFoundMessage={tr("completedCourses.notFound")}
        description={tr("completedCourses.description")}
      />
      {repeatableCodes.length > 0 ? (
        <Stack gap={6}>
          <Text size="sm" fw={600} c="var(--app-text)">
            {tr("completedCourses.repeatable.heading")}
          </Text>
          <Text size="xs" c="var(--app-text-muted)" lh={1.5}>
            {tr("completedCourses.repeatable.hint")}
          </Text>
          {repeatableCodes.map((code) => {
            const count = repeatableCounts.get(code) ?? 0;
            return (
              <Group key={code} justify="space-between" wrap="nowrap" gap="sm">
                <Text size="sm" c="var(--app-text)">
                  {formatCourseWithTitle(code, cache)}
                </Text>
                <Group gap={6} wrap="nowrap">
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label={tr("completedCourses.repeatable.remove")}
                    disabled={count === 0}
                    onClick={() => removeRepeatable(code)}
                  >
                    <IconMinus size={14} />
                  </ActionIcon>
                  <Text size="sm" fw={600} c="var(--app-text)" w={16} ta="center">
                    {count}
                  </Text>
                  <ActionIcon
                    variant="default"
                    size="sm"
                    aria-label={tr("completedCourses.repeatable.add")}
                    onClick={() => addRepeatable(code)}
                  >
                    <IconPlus size={14} />
                  </ActionIcon>
                </Group>
              </Group>
            );
          })}
        </Stack>
      ) : null}
    </Stack>
  );
}
