import { List, Stack, Text } from "@mantine/core";
import type { GenerationErrorDetails } from "@uoplan/store/types";
import { tr, useTr } from "../i18n";
import { formatFilterHint, formatSuggestions } from "../lib/generationDiagnosticsText";
import { hasDetailContent } from "../lib/generationErrorDetail";

function formatCourseList(courses: string[]): string {
  if (courses.length === 0) return "";
  if (courses.length === 1) return courses[0];
  if (courses.length === 2) return tr("gen.list.two", { a: courses[0], b: courses[1] });
  if (courses.length > 5) {
    return tr("gen.list.overflow", {
      head: courses.slice(0, 5).join(", "),
      count: courses.length - 5,
    });
  }
  const last = courses[courses.length - 1];
  const rest = courses.slice(0, -1);
  return tr("gen.list.many", { rest: rest.join(", "), last });
}

export function GenerationErrorDetailBlocks({
  errorDetails,
  summarizeEmptyPools,
}: {
  errorDetails: GenerationErrorDetails | null | undefined;
  summarizeEmptyPools: boolean;
}) {
  useTr();
  if (!errorDetails || !hasDetailContent(errorDetails)) return null;

  const tf = errorDetails.timetableFailure;
  const suggestions = tf ? formatSuggestions(tf) : [];

  return (
    <Stack gap="sm" pt="xs">
      {errorDetails.totalAvailable < errorDetails.totalNeeded && (
        <Text size="xs" c="dimmed">
          {tr("gen.slots.summary", {
            available: errorDetails.totalAvailable,
            needed: errorDetails.totalNeeded,
          })}
          {errorDetails.emptyPools.length > 0 && !summarizeEmptyPools && (
            <>
              {" — "}
              {errorDetails.emptyPools.map((p, i) => (
                <Text key={p.requirementId ?? p.label} size="xs" fw={500} span>
                  {i > 0 &&
                    (i === errorDetails.emptyPools.length - 1
                      ? tr("gen.join.and")
                      : tr("gen.join.comma"))}
                  {p.label}
                </Text>
              ))}{" "}
              {tr("gen.pools.haveNoCourses", { count: errorDetails.emptyPools.length })}
            </>
          )}
          .
        </Text>
      )}

      {errorDetails.emptyPools.length > 0 && summarizeEmptyPools && (
        <Text size="xs" c="dimmed">
          {tr("gen.pools.otherSummary", { count: errorDetails.emptyPools.length })}
        </Text>
      )}

      {errorDetails.emptyPools.length > 0 && !summarizeEmptyPools && (
        <>
          <Text size="xs" fw={600}>
            {tr("gen.pools.heading")}
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
                      {tr("gen.pools.blockedByFilters", {
                        count: candidates.length,
                        courses: formatCourseList(candidates),
                      })}
                    </Text>
                  ) : (
                    <Text size="xs" c="dimmed" span>
                      {" "}
                      {tr("gen.pools.noSectionsThisTerm")}
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
            {tr("gen.hints.heading")}
          </Text>
          <List size="xs" spacing={4} withPadding>
            {errorDetails.activeFilterHints.map((hint, i) => (
              <List.Item key={i}>{formatFilterHint(hint)}</List.Item>
            ))}
          </List>
        </>
      )}

      {tf && tf.coursesWithNoCombo.length > 0 && (
        <>
          <Text size="xs" fw={600}>
            {tr("gen.noSections.heading")}
          </Text>
          <Text size="xs" c="dimmed" style={{ fontFamily: "monospace" }}>
            {tf.coursesWithNoCombo.join(", ")}
          </Text>
        </>
      )}
      {suggestions.length > 0 && (
        <>
          <Text size="xs" fw={600}>
            {tr("gen.quickFixes.heading")}
          </Text>
          <List size="xs" spacing={4} withPadding>
            {suggestions.map((s, i) => (
              <List.Item key={i}>{s}</List.Item>
            ))}
          </List>
        </>
      )}
    </Stack>
  );
}
