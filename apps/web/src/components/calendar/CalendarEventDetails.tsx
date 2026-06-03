import { useMemo } from "react";
import { ActionIcon, Anchor, Box, Group, Stack, Text, Tooltip } from "@mantine/core";
import { IconBan, IconLock, IconLockFilled, IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import { courseAPlusPercent, normalizeCourseCode } from "@uoplan/core";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import { useSwapActions } from "../../hooks/useSwapActions";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { tr } from "../../i18n";
import { EventInfoSection } from "./EventInfoSection";
import { SwapList } from "./SwapList";
import { useSwapContext } from "./swapContext";

interface CalendarEventDetailsProps {
  event: CalendarEvent;
  courseTitle: string;
  /** Hide the header close button (e.g. when the mobile drawer provides its own). */
  hideCloseButton?: boolean;
}

/**
 * Interactive content for the swap overlay: course header with lock/blacklist
 * actions, read-only event details, and the ranked list of swap candidates.
 * Rendered inside a popover on desktop and a bottom drawer on mobile.
 */
export function CalendarEventDetails({
  event,
  courseTitle,
  hideCloseButton = false,
}: CalendarEventDetailsProps) {
  const ctx = useSwapContext();

  const courseCode = event.courseCode;
  const courseNorm = normalizeCourseCode(courseCode);

  const actions = useSwapActions({
    courseCode,
    enrollmentIndex: event.enrollmentIndex,
    closeModal: ctx?.closeModal ?? (() => {}),
  });

  const currentAPlusPercent = useMemo(() => {
    const sched = ctx?.cache?.getSchedule(courseNorm);
    return sched ? courseAPlusPercent(sched) : null;
  }, [ctx?.cache, courseNorm]);

  if (!ctx) return null;

  const requirementTitle = ctx.result.requirementTitle;

  return (
    <Stack gap="sm">
      {/* Header */}
      <Group justify="space-between" align="flex-start" wrap="nowrap" gap="sm">
        <Box style={{ minWidth: 0 }}>
          <Group gap={6} wrap="nowrap" align="baseline">
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
              {courseCode}
            </Anchor>
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
          {requirementTitle ? (
            <Text size="xs" c="dimmed" lh={1.3} truncate>
              {requirementTitle}
            </Text>
          ) : null}
        </Box>
        <Group gap={2} wrap="nowrap" style={{ flexShrink: 0 }}>
          <Tooltip label={actions.blacklistTooltip} position="bottom" withArrow>
            <Box component="span" style={{ display: "inline-flex" }}>
              <ActionIcon
                variant="subtle"
                color={actions.isBlacklisted ? "red" : "gray"}
                size="sm"
                disabled={actions.blacklistControlDisabled}
                aria-label={actions.blacklistAria}
                onClick={actions.handleBlacklistToggle}
              >
                <IconBan size={16} stroke={1.5} />
              </ActionIcon>
            </Box>
          </Tooltip>
          <Tooltip label={actions.lockTooltip} position="bottom" withArrow>
            <Box component="span" style={{ display: "inline-flex" }}>
              <ActionIcon
                variant="subtle"
                color={actions.showLockedIcon ? "yellow" : "gray"}
                size="sm"
                disabled={actions.lockControlDisabled}
                aria-label={actions.lockAria}
                onClick={actions.handleLockToggle}
              >
                {actions.showLockedIcon ? (
                  <IconLockFilled size={16} stroke={1.5} />
                ) : (
                  <IconLock size={16} stroke={1.5} />
                )}
              </ActionIcon>
            </Box>
          </Tooltip>
          {!hideCloseButton && (
            <ActionIcon
              variant="subtle"
              color="gray"
              size="sm"
              aria-label={tr("calendar.swap.close")}
              onClick={ctx.closeModal}
            >
              <IconX size={16} stroke={1.5} />
            </ActionIcon>
          )}
        </Group>
      </Group>

      <EventInfoSection event={event} />

      <Box>
        <SwapList
          modalState={{
            enrollmentIndex: event.enrollmentIndex,
            courseCode,
            virtual: event.virtual,
            componentSection: event.componentSection,
            gradeViz: event.gradeViz,
          }}
          loading={ctx.loading}
          result={ctx.result}
          candidateOptions={ctx.candidateOptions}
          query={ctx.query}
          setQuery={ctx.setQuery}
          closeModal={ctx.closeModal}
          onSwap={ctx.onSwap}
          preferEasier={ctx.preferEasier}
          currentAPlusPercent={currentAPlusPercent}
        />
      </Box>
    </Stack>
  );
}
