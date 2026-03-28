import { List, Stack, Text } from "@mantine/core";
import type { GenerationErrorDetails } from "../store/types";

export function formatEmptyPoolLabel(p: {
  label: string;
  requirementId?: string;
}): string {
  const isGeneric = p.label === "course" || p.label === "or_course";
  return isGeneric ? "Requirement" : p.label;
}

function hasDetailContent(errorDetails: GenerationErrorDetails): boolean {
  if (errorDetails.totalAvailable < errorDetails.totalNeeded) return true;
  if (errorDetails.emptyPools.length > 0) return true;
  const tf = errorDetails.timetableFailure;
  if (!tf) return false;
  if (tf.coursesWithNoCombo.length > 0) return true;
  if (tf.suggestions.length > 0) return true;
  return false;
}

export function GenerationErrorDetailBlocks({
  errorDetails,
  summarizeEmptyPools,
}: {
  errorDetails: GenerationErrorDetails | null | undefined;
  summarizeEmptyPools: boolean;
}) {
  if (!errorDetails || !hasDetailContent(errorDetails)) return null;

  const tf = errorDetails.timetableFailure;

  return (
    <Stack gap="sm" pt="xs">
      {errorDetails.totalAvailable < errorDetails.totalNeeded && (
        <Text size="xs" c="dimmed">
          Only {errorDetails.totalAvailable} of {errorDetails.totalNeeded} course
          slots can be filled with your current filters.
        </Text>
      )}
      {errorDetails.emptyPools.length > 0 && summarizeEmptyPools && (
        <Text size="xs" c="dimmed">
          {errorDetails.emptyPools.length} other requirements have no eligible
          courses (often future-term sections not posted yet).
        </Text>
      )}
      {errorDetails.emptyPools.length > 0 && !summarizeEmptyPools && (
        <>
          <Text size="xs" fw={600}>
            No eligible courses this term
          </Text>
          <List size="xs" spacing={4} withPadding>
            {errorDetails.emptyPools.map((p) => (
              <List.Item key={p.requirementId ?? p.label}>
                {formatEmptyPoolLabel(p)}
              </List.Item>
            ))}
          </List>
        </>
      )}
      {tf && tf.coursesWithNoCombo.length > 0 && (
        <>
          <Text size="xs" fw={600}>
            No matching sections (filters / timetable)
          </Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
            {tf.coursesWithNoCombo.join(", ")}
          </Text>
        </>
      )}
      {tf && tf.suggestions.length > 0 && (
        <>
          <Text size="xs" fw={600}>
            Quick fixes
          </Text>
          <List size="xs" spacing={4} withPadding>
            {tf.suggestions.map((s, i) => (
              <List.Item key={i}>{s}</List.Item>
            ))}
          </List>
        </>
      )}
    </Stack>
  );
}
