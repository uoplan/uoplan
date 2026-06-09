import { useMemo } from "react";
import type { MouseEvent } from "react";
import { Anchor, Box, Divider, Group, Stack, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { DAY_LABELS } from "@uoplan/calendar";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import { tr } from "../../i18n";
import { GradeDistributionExpanded } from "./GradeDistributionViz";
import { formatTimeRange } from "./calendarEventDisplayUtils";

function formatMeetingDateRange(meetingDates: [string, string]): string {
  const [start, end] = meetingDates;
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return "";
  const sameYear = s.getUTCFullYear() === e.getUTCFullYear();
  const fmtNoYear = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  const fmtWithYear = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const startStr = sameYear ? fmtNoYear.format(s) : fmtWithYear.format(s);
  return `${startStr} – ${fmtWithYear.format(e)}`;
}

interface EventInfoSectionProps {
  event: CalendarEvent;
}

type ProfessorRatingDetail = NonNullable<CalendarEvent["professorRatingDetails"]>[number];

/** Explore-page route param for a professor: numeric legacyId when known,
 * otherwise the URL-encoded name (the route handles both). */
function professorRouteParam(detail: ProfessorRatingDetail): string {
  return detail.legacyId != null ? String(detail.legacyId) : encodeURIComponent(detail.name);
}

/** Read-only details for a calendar event (section, time, instructor, ratings,
 * grade distribution). Shown inside the swap overlay (popover on desktop,
 * drawer on mobile) above the list of swap candidates. */
export function EventInfoSection({ event }: EventInfoSectionProps) {
  const timeRange = useMemo(
    () => formatTimeRange(event.startMinutes, event.endMinutes),
    [event.startMinutes, event.endMinutes],
  );
  const dayLabel = DAY_LABELS[event.day];
  const dateRange = useMemo(
    () => (event.meetingDates ? formatMeetingDateRange(event.meetingDates) : ""),
    [event.meetingDates],
  );

  const ratingDetails = event.professorRatingDetails ?? [];
  const hasProfessor = event.professor.trim() !== "" && event.professor !== "—";

  return (
    <Stack gap={8}>
      <Stack gap={4}>
        <Group gap={6} wrap="nowrap" justify="space-between">
          <Text size="xs" c="dimmed">
            {tr("calendar.hover.section")}
          </Text>
          <Text size="xs" fw={500}>
            {event.componentSection}
          </Text>
        </Group>
        <Group gap={6} wrap="nowrap" justify="space-between">
          <Text size="xs" c="dimmed">
            {tr("calendar.hover.when")}
          </Text>
          <Text size="xs" fw={500}>
            {dayLabel} · {timeRange}
          </Text>
        </Group>
        {dateRange ? (
          <Group gap={6} wrap="nowrap" justify="space-between">
            <Text size="xs" c="dimmed">
              {tr("calendar.hover.dates")}
            </Text>
            <Text size="xs" fw={500}>
              {dateRange}
            </Text>
          </Group>
        ) : null}
      </Stack>

      {event.courseSentiment != null || event.professorSentiment != null ? (
        <>
          <Divider />
          <Stack gap={4}>
            <Text size="xs" c="dimmed" fw={600}>
              {tr("calendar.hover.satisfaction")}
            </Text>
            {event.courseSentiment != null ? (
              <Group gap={6} wrap="nowrap" justify="space-between" align="baseline">
                <Text size="xs" c="dimmed">
                  {tr("calendar.hover.satisfactionCourse")}
                </Text>
                <Text size="xs" fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {tr("calendar.hover.satisfactionValue", {
                    value: event.courseSentiment.toFixed(1),
                  })}
                </Text>
              </Group>
            ) : null}
            {event.professorSentiment != null ? (
              <Group gap={6} wrap="nowrap" justify="space-between" align="baseline">
                <Text size="xs" c="dimmed">
                  {tr("calendar.hover.satisfactionProfessor")}
                </Text>
                <Text size="xs" fw={600} style={{ fontVariantNumeric: "tabular-nums" }}>
                  {tr("calendar.hover.satisfactionValue", {
                    value: event.professorSentiment.toFixed(1),
                  })}
                </Text>
              </Group>
            ) : null}
          </Stack>
        </>
      ) : null}

      {hasProfessor ? (
        <>
          <Divider />
          <Group gap={6} wrap="nowrap" justify="space-between" align="flex-start">
            <Text size="xs" c="dimmed" style={{ flexShrink: 0 }}>
              {tr("calendar.hover.instructor")}
            </Text>
            {ratingDetails.length > 0 ? (
              <Stack gap={2} align="flex-end" style={{ minWidth: 0 }}>
                {ratingDetails.map((d) => (
                  <Group key={d.name} gap={6} wrap="nowrap" align="baseline">
                    <Anchor
                      size="xs"
                      fw={500}
                      ta="right"
                      onClick={(e: MouseEvent) => e.stopPropagation()}
                      renderRoot={(props) => (
                        <Link
                          to="/explore/professor/$legacyId"
                          params={{ legacyId: professorRouteParam(d) }}
                          {...props}
                        />
                      )}
                    >
                      {d.name}
                    </Anchor>
                    {d.numRatings > 0 ? (
                      d.legacyId ? (
                        <Anchor
                          href={`https://www.ratemyprofessors.com/professor/${d.legacyId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          c="dimmed"
                          style={{ whiteSpace: "nowrap", flexShrink: 0 }}
                          onClick={(e: MouseEvent) => e.stopPropagation()}
                        >
                          {tr("calendar.hover.ratingValue", {
                            rating: d.rating.toFixed(1).replace(/\.0$/, ""),
                            count: d.numRatings,
                          })}
                        </Anchor>
                      ) : (
                        <Text size="xs" c="dimmed" style={{ whiteSpace: "nowrap", flexShrink: 0 }}>
                          {tr("calendar.hover.ratingValue", {
                            rating: d.rating.toFixed(1).replace(/\.0$/, ""),
                            count: d.numRatings,
                          })}
                        </Text>
                      )
                    ) : null}
                  </Group>
                ))}
              </Stack>
            ) : (
              <Text size="xs" fw={500} ta="right">
                {event.professor}
              </Text>
            )}
          </Group>
        </>
      ) : null}

      {!hasProfessor && (event.predictedInstructors?.length ?? 0) > 0 ? (
        <>
          <Divider />
          <Stack gap={4}>
            <Group gap={6} wrap="nowrap" justify="space-between" align="baseline">
              <Text size="xs" c="dimmed">
                {tr("calendar.hover.instructorPredicted")}
              </Text>
              <Text size="xs" c="dimmed" fs="italic">
                {tr("calendar.hover.instructorPredictedHint")}
              </Text>
            </Group>
            {event.predictedInstructors?.map((p) =>
              p.legacyId != null ? (
                <Anchor
                  key={`${p.name}-${p.legacyId}`}
                  size="xs"
                  fw={500}
                  onClick={(e: MouseEvent) => e.stopPropagation()}
                  renderRoot={(props) => (
                    <Link
                      to="/explore/professor/$legacyId"
                      params={{ legacyId: String(p.legacyId) }}
                      {...props}
                    />
                  )}
                >
                  {p.name}
                </Anchor>
              ) : (
                <Text key={p.name} size="xs" fw={500}>
                  {p.name}
                </Text>
              ),
            )}
          </Stack>
        </>
      ) : null}

      {event.gradeViz && event.gradeViz.total > 0 ? (
        <>
          <Divider />
          <Box>
            <Text size="xs" c="dimmed" fw={600} mb={6}>
              {tr("calendar.grade.distribution")}
            </Text>
            <GradeDistributionExpanded gradeViz={event.gradeViz} />
          </Box>
        </>
      ) : null}
    </Stack>
  );
}
