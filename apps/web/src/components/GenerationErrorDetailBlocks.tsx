import { List, Stack, Text } from "@mantine/core";
import type { GenerationErrorDetails } from "../store/types";

function formatCourseList(courses: string[]): string {
  if (courses.length === 0) return "";
  if (courses.length === 1) return courses[0];
  if (courses.length === 2) return `${courses[0]} or ${courses[1]}`;
  if (courses.length > 5) {
    return `${courses.slice(0, 5).join(", ")}, or ${courses.length - 5} more`;
  }
  const last = courses[courses.length - 1];
  const rest = courses.slice(0, -1);
  return `${rest.join(", ")}, or ${last}`;
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
          Only {errorDetails.totalAvailable} of {errorDetails.totalNeeded} course slots can be
          filled with your current filters
          {errorDetails.emptyPools.length > 0 && !summarizeEmptyPools && (
            <>
              {" — "}
              {errorDetails.emptyPools.length === 1 ? (
                <Text size="xs" fw={500} span>
                  {errorDetails.emptyPools[0].label}
                </Text>
              ) : (
                errorDetails.emptyPools.map((p, i) => (
                  <Text key={p.requirementId ?? p.label} size="xs" fw={500} span>
                    {i > 0 && (i === errorDetails.emptyPools.length - 1 ? " and " : ", ")}
                    {p.label}
                  </Text>
                ))
              )}{" "}
              {errorDetails.emptyPools.length === 1 ? "has" : "have"} no eligible courses
            </>
          )}
          .
        </Text>
      )}

      {errorDetails.emptyPools.length > 0 && summarizeEmptyPools && (
        <Text size="xs" c="dimmed">
          {errorDetails.emptyPools.length} other requirements have no eligible courses (often
          future-term sections not posted yet).
        </Text>
      )}

      {errorDetails.emptyPools.length > 0 && !summarizeEmptyPools && (
        <>
          <Text size="xs" fw={600}>
            Requirements with no eligible courses
          </Text>
          <List size="xs" spacing={4} withPadding>
            {errorDetails.emptyPools.map((p) => {
              const candidates = p.candidateCourses ?? [];
              return (
                <List.Item key={p.requirementId ?? p.label}>
                  <Text size="xs" fw={500} span>
                    {p.label}
                  </Text>
                  {candidates.length > 0 ? (
                    <Text size="xs" c="dimmed" span>
                      {" "}
                      — {formatCourseList(candidates)}{" "}
                      {candidates.length === 1 ? "qualifies" : "qualify"} but{" "}
                      {candidates.length === 1 ? "is" : "are"} blocked by current filters
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed" span>
                      {" "}
                      — no sections offered this term
                    </Text>
                  )}
                </List.Item>
              );
            })}
          </List>
        </>
      )}

      {errorDetails.activeFilterHints && errorDetails.activeFilterHints.length > 0 && (
        <>
          <Text size="xs" fw={600}>
            Active filters limiting results
          </Text>
          <List size="xs" spacing={4} withPadding>
            {errorDetails.activeFilterHints.map((hint, i) => (
              <List.Item key={i}>{hint}</List.Item>
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
