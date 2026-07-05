import { Anchor, Stack, Text, Tooltip } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { normalizeCourseCode } from "@uoplan/core";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { tr } from "../../i18n";
import { EventInfoSection } from "../calendar/EventInfoSection";

interface PlannerEventDetailsProps {
  event: CalendarEvent;
  courseTitle: string;
}

/**
 * Read-only details popover for a course in a planner term calendar: a course
 * header (linked to the explore page) plus the shared {@link EventInfoSection}
 * (section, time, ratings, grade distribution). It deliberately omits the swap
 * list and lock/blacklist actions from the interactive calendar's overlay:
 * editing a term happens through "Open in calendar", not on the graph.
 */
export function PlannerEventDetails({ event, courseTitle }: PlannerEventDetailsProps) {
  const courseNorm = normalizeCourseCode(event.courseCode);
  return (
    <Stack gap="sm">
      <div>
        <Anchor
          fw={700}
          size="sm"
          c="inherit"
          underline="hover"
          renderRoot={(props) => (
            <Link
              to="/explore/course/$course"
              params={{ course: courseNormToPathParam(courseNorm) }}
              {...props}
            />
          )}
        >
          {event.courseCode}
        </Anchor>
        {event.virtual ? (
          <Text span size="xs" c="dimmed" ml={6}>
            {tr("calendar.event.virtual")}
          </Text>
        ) : null}
        {courseTitle ? (
          <Tooltip
            label={courseTitle}
            withArrow
            multiline
            maw={300}
            position="bottom"
            openDelay={300}
          >
            <Text size="xs" c="dimmed" lh={1.3} truncate style={{ cursor: "default" }}>
              {courseTitle}
            </Text>
          </Tooltip>
        ) : null}
      </div>
      <EventInfoSection event={event} />
    </Stack>
  );
}
