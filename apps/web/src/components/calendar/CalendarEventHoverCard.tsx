import { useMemo } from "react";
import type { MouseEvent } from "react";
import { Anchor, Box, Button, Divider, Group, Stack, Text } from "@mantine/core";
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

interface CalendarEventHoverCardProps {
  event: CalendarEvent;
  courseTitle: string;
  /** Opens the swap/detail panel (same action as clicking the event). */
  onOpenDetails: () => void;
}

/** Rich, read-only hover preview for a calendar event. Shows extended info that
 * does not always fit in the small event face, plus a button that opens the
 * existing swap/detail panel. */
export function CalendarEventHoverCard({
  event,
  courseTitle,
  onOpenDetails,
}: CalendarEventHoverCardProps) {
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
    <Stack gap={8} w={280}>
      <Box>
        <Group gap={6} wrap="nowrap" align="baseline">
          <Text fw={700} size="sm">
            {event.courseCode}
          </Text>
          {event.virtual ? (
            <Text size="xs" c="dimmed">
              {tr("calendar.event.virtual")}
            </Text>
          ) : null}
        </Group>
        {courseTitle ? (
          <Text size="xs" c="dimmed" lh={1.3}>
            {courseTitle}
          </Text>
        ) : null}
      </Box>

      <Divider />

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

      {hasProfessor ? (
        <>
          <Divider />
          <Stack gap={4}>
            <Group gap={6} wrap="nowrap" justify="space-between">
              <Text size="xs" c="dimmed">
                {tr("calendar.hover.instructor")}
              </Text>
              <Text size="xs" fw={500} ta="right">
                {event.professor}
              </Text>
            </Group>
            {ratingDetails.length > 0 ? (
              <Stack gap={2}>
                <Text size="xs" fw={600} c="dimmed">
                  RateMyProfessors
                </Text>
                {ratingDetails.map((d) => (
                  <Group key={d.name} gap={6} wrap="nowrap" justify="space-between">
                    <Text size="xs">{d.name}</Text>
                    {d.numRatings > 0 ? (
                      d.legacyId ? (
                        <Anchor
                          href={`https://www.ratemyprofessors.com/professor/${d.legacyId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          size="xs"
                          onClick={(e: MouseEvent) => e.stopPropagation()}
                        >
                          {tr("calendar.hover.ratingValue", {
                            rating: d.rating.toFixed(1).replace(/\.0$/, ""),
                            count: d.numRatings,
                          })}
                        </Anchor>
                      ) : (
                        <Text size="xs">
                          {tr("calendar.hover.ratingValue", {
                            rating: d.rating.toFixed(1).replace(/\.0$/, ""),
                            count: d.numRatings,
                          })}
                        </Text>
                      )
                    ) : (
                      <Text size="xs" c="dimmed">
                        {tr("calendar.hover.ratingNone")}
                      </Text>
                    )}
                  </Group>
                ))}
              </Stack>
            ) : null}
          </Stack>
        </>
      ) : null}

      {event.gradeViz && event.gradeViz.total > 0 ? (
        <>
          <Divider />
          <GradeDistributionExpanded gradeViz={event.gradeViz} />
        </>
      ) : null}

      <Divider />

      <Stack gap={6}>
        <Text size="xs" c="dimmed" ta="center">
          {tr("calendar.hover.hint")}
        </Text>
        <Button size="xs" variant="light" fullWidth onClick={onOpenDetails}>
          {tr("calendar.hover.viewDetails")}
        </Button>
      </Stack>
    </Stack>
  );
}
