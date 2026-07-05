import { Button, Group, NumberInput, Stack, Text } from "@mantine/core";
import {
  IconCalendarDown,
  IconCalendarEvent,
  IconChevronLeft,
  IconChevronRight,
  IconSchool,
  IconSparkles,
  IconTrash,
} from "@tabler/icons-react";
import { tr, useTr } from "../../i18n";
import { plannerTermCount, useGraphPlannerStore } from "../../store/graphPlannerStore";
import { useSeedNavigation } from "../../store/hooks";
import { canDownloadTerm } from "../../lib/graphPlanner/downloadPlannerIcs";
import { NoTimeslotBanner } from "../calendar/NoTimeslotBanner";
import { usePlannerActions } from "./plannerActionsContext";

/**
 * Per-term planner controls, consolidated out of the graph node and into the
 * tabbed panel — the "sidebar for that term". When the term isn't enabled yet it
 * shows a single enable prompt (or a "pick a program" nudge). Once enabled it
 * mirrors the calendar's variant navigation (Previous / Next), a Generate action
 * before the first run, plus course count, download-this-term, open-in-calendar,
 * and remove. The shared cart + advanced options live below the panel tabs (they
 * are global), so this component only carries the term-scoped actions.
 */
export function PlannerTermControls({
  termId,
  calendarMode = false,
}: {
  termId: string;
  calendarMode?: boolean;
}) {
  useTr();
  const actions = usePlannerActions();
  const enabled = useGraphPlannerStore((s) => s.enabledTermIds.includes(termId));
  const count = useGraphPlannerStore((s) => plannerTermCount(s, termId));
  const bundle = useGraphPlannerStore((s) => s.resultByTermId[termId]);
  const seed = useGraphPlannerStore((s) => s.seedByTermId[termId] ?? 0);
  const { firstSeed } = useSeedNavigation();
  const running = actions.runningTermId === termId;
  const downloadable = canDownloadTerm(bundle);
  // "Has this term generated at least once?" — true as soon as a run has
  // advanced its seed off the unset `0`. We key the Prev/Next vs. Generate
  // affordance off this rather than the live schedule, because a regenerate
  // briefly clears the bundle and we don't want the controls to flip back to a
  // lone "Generate" button (then flip back) on every navigation.
  const hasGenerated = seed > 0 || Boolean(bundle?.currentSchedule);
  // The seed ladder is anchored at firstSeed (firstSeed, firstSeed+1, …), so a
  // term can step back only once it has advanced past its first variant.
  const canGoPrevious = seed !== 0 && seed > firstSeed;

  if (!enabled) {
    if (!actions.hasProgram) {
      return (
        <Stack gap="xs">
          <Text fz="sm" c="dimmed">
            {tr("planner.needProgram.body")}
          </Text>
          <Button
            size="xs"
            variant="light"
            leftSection={<IconSchool size={14} />}
            onClick={actions.goToPersonalize}
          >
            {tr("planner.needProgram.cta")}
          </Button>
        </Stack>
      );
    }
    return (
      <Stack gap="xs">
        <Text fz="sm" c="dimmed">
          {tr("planner.term.enableHint")}
        </Text>
        <Button
          size="sm"
          disabled={actions.isGenerating}
          onClick={() => actions.enableTerm(termId)}
        >
          {tr("planner.term.enable")}
        </Button>
      </Stack>
    );
  }

  // While this term is expanded into the calendar overlay, the calendar card +
  // shared generation options own all the controls; here we only surface the
  // "some courses don't appear on the schedule" notice for the live timetable.
  if (calendarMode) {
    return <NoTimeslotBanner />;
  }

  return (
    <Stack gap="sm">
      {hasGenerated ? (
        <Button.Group>
          <Button
            variant="default"
            size="sm"
            style={{ flex: 1 }}
            leftSection={<IconChevronLeft size={14} />}
            disabled={!canGoPrevious || actions.isGenerating}
            loading={running}
            onClick={() => actions.previousTerm(termId)}
          >
            {tr("calendarPage.previous")}
          </Button>
          <Button
            variant="default"
            size="sm"
            style={{ flex: 1 }}
            rightSection={<IconChevronRight size={14} />}
            disabled={actions.isGenerating}
            loading={running}
            onClick={() => actions.regenerateTerm(termId)}
          >
            {tr("calendarPage.next")}
          </Button>
        </Button.Group>
      ) : (
        <Button
          size="sm"
          leftSection={<IconSparkles size={16} />}
          loading={running}
          disabled={actions.isGenerating}
          onClick={() => actions.regenerateTerm(termId)}
        >
          {tr("calendarPage.generate")}
        </Button>
      )}

      <NumberInput
        size="xs"
        label={tr("planner.band.courseCount")}
        min={1}
        max={12}
        value={count}
        disabled={actions.isGenerating}
        onChange={(v) =>
          actions.changeCount(termId, typeof v === "number" ? v : Number(v) || count)
        }
      />

      <Group gap="xs" grow>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconCalendarDown size={15} />}
          disabled={!downloadable}
          onClick={() => actions.downloadTerm(termId)}
        >
          {tr("planner.download.term")}
        </Button>
        <Button
          size="xs"
          variant="light"
          leftSection={<IconCalendarEvent size={15} />}
          disabled={actions.isGenerating}
          onClick={() => actions.openInCalendar(termId)}
        >
          {tr("planner.band.openInCalendar")}
        </Button>
      </Group>

      <Button
        size="xs"
        variant="subtle"
        color="red"
        leftSection={<IconTrash size={14} />}
        disabled={actions.isGenerating}
        onClick={() => actions.disableTerm(termId)}
        style={{ alignSelf: "flex-start", paddingInline: 6 }}
      >
        {tr("planner.band.disable")}
      </Button>
    </Stack>
  );
}
