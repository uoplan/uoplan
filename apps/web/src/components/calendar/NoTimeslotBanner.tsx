import { Alert, Badge, Group, Text } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { tr, useTr } from "../../i18n";
import { useDataCache, useScheduleGeneration } from "@uoplan/store/hooks";

/**
 * "Some courses don't appear on the schedule" — lists courses in the current
 * generated schedule that have no meeting times (async / TBA), so they can't be
 * drawn on the timetable grid. Self-contained (reads the live schedule + course
 * cache from the store) so it can be dropped wherever the current schedule is
 * relevant: the calendar page itself and the graph planner's calendar overlay
 * sidebar. Renders nothing when every enrolled course has a timeslot.
 */
export function NoTimeslotBanner() {
  useTr();
  const cache = useDataCache();
  const { currentSchedule } = useScheduleGeneration();

  const noTimeslotCourses =
    currentSchedule?.enrollments
      .filter((enrollment) => enrollment.times.length === 0)
      .map((enrollment) => {
        const title = cache?.getCourse(enrollment.courseCode)?.title.trim();
        return { code: enrollment.courseCode, title: title || null };
      }) ?? [];

  if (noTimeslotCourses.length === 0) return null;

  return (
    <Alert
      icon={<IconInfoCircle size={16} />}
      radius="md"
      py="xs"
      data-testid="no-timeslot-banner"
      style={{
        flexShrink: 0,
        backgroundColor: "var(--app-info-soft)",
        border: "1px solid var(--app-info)",
      }}
    >
      <Group gap={6} align="center" wrap="wrap">
        <Text size="xs" fw={600} style={{ color: "var(--app-text)" }}>
          {tr("calendarPage.noTimeslotCourses.title")}
        </Text>
        {noTimeslotCourses.map((course) => (
          <Badge
            key={course.code}
            size="sm"
            variant="light"
            color="gray"
            title={course.title ? `${course.code}: ${course.title}` : course.code}
          >
            {course.code}
          </Badge>
        ))}
      </Group>
    </Alert>
  );
}
