import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { courseSentimentByNorm } from "@uoplan/core/feedback";
import type { TimetableFailureDiagnostics } from "@uoplan/core/generationDiagnostics";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import type { CalendarEvent } from "@uoplan/calendar/types";
import { computeWeekGroups, slotActiveInWeek, type WeekGroup } from "@uoplan/calendar/weeks";
import type { BlockedTimeWindow } from "@uoplan/core";

import { Button, Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { CalendarEventDrawer } from "@/components/calendar-event-drawer";
import { GenerationErrorDetailsSheet } from "@/components/generation-error-details-sheet";
import { BottomControlBar, useFloatingControlsBottom } from "@/components/redesign";
import { PillButton } from "@/components/redesign/pill-button";
import { ScheduleSettingsSheet } from "@/components/schedule-settings-sheet";
import { WeekCalendar } from "@/components/week-calendar";
import { Spacing, Surface } from "@/constants/theme";
import { useAppData } from "@/data/data-provider";
import { useBasket } from "@/data/basket-provider";
import { useCompletedCourses } from "@/data/completed-courses-provider";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { addScheduleToCalendar } from "@/lib/add-to-calendar";
import { useAnalytics, getAnalytics } from "@/lib/analytics";
import { exportScheduleIcs } from "@/lib/share-ics";
import { computeSwapOptions, type SwapOption } from "@/lib/swap-course";
import { formatGenerationLead, formatSuggestions } from "@/lib/generation-messages";
import { useScheduleGeneration } from "@/lib/use-schedule-generation";
import type { SkippedCourse } from "@/lib/generate-schedule";

/** Height of the floating {@link BottomControlBar} pill (gear + pager). */
const CONTROL_BAR_HEIGHT = 56;

/** Extra reserved space when the week pager pill (40px) + its gap sit above. */
const WEEK_PAGER_BLOCK = 48;

/** Top space reserved to clear the global settings gear (mounted per tab stack). */
const SETTINGS_BUTTON = 48;
const TERM_START_DATE = "2025-09-03";
const TERM_END_DATE = "2025-12-05";

/**
 * Filter a variant's calendar events down to the ones that actually meet during
 * the given week group. Whole-term slots (no `meetingDates`) always show; dated
 * slots (labs/tutorials with limited runs) show only when their occurrence falls
 * inside the week. Mirrors the web `CalendarView` week filter.
 */
function eventsForWeek(events: CalendarEvent[], group: WeekGroup | null): CalendarEvent[] {
  if (!group) return events;
  return events.filter(
    (e) => !e.meetingDates || slotActiveInWeek(e.day, e.meetingDates, group.startDate),
  );
}

/** Compact "Week X / N" pager label (the user's requested week format). */
function weekPagerLabel(index: number, total: number): string {
  return `Week ${index + 1} / ${total}`;
}

/**
 * Schedule tab — a full-bleed weekly timetable matching the web mobile schedule.
 * Real conflict-free timetables are generated from the basket by the native Rust
 * engine (the same crate the web app runs as WASM), giving byte-for-byte parity
 * with the web generator. The {@link WeekCalendar} fills the screen; a floating
 * {@link BottomControlBar} pages through generated variants and opens the
 * preferences sheet (build CTA, generation switches, calendar export, reminders).
 */
export default function ScheduleScreen() {
  const router = useRouter();
  const analytics = useAnalytics();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const basket = useBasket();
  const { count } = basket;
  const completed = useCompletedCourses();
  const { bundle, schedulesByTerm, feedback } = useAppData();
  const { options, setOptions, personalization } = useScheduleOptions();
  const {
    status,
    variants,
    termId,
    diagnostics,
    skippedCourses,
    regenerate,
    index,
    hasPrev,
    hasNext,
    loadingMore,
    next,
    prev,
  } = useScheduleGeneration();

  const [prefsOpen, setPrefsOpen] = useState(false);
  const [selected, setSelected] = useState<{ event: CalendarEvent; color: string } | null>(null);
  const [swap, setSwap] = useState<{ loading: boolean; options: SwapOption[] }>({
    loading: false,
    options: [],
  });
  const [exporting, setExporting] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);
  // Which distinct week pattern of the term is shown. Defaults to the busiest
  // week (most class time) of the active variant — see the reset effect below.
  const [weekIndex, setWeekIndex] = useState(0);

  const titleByCode = useMemo(
    () => new Map(bundle.catalogue.courses.map((c) => [c.code, c.title] as const)),
    [bundle],
  );

  const courseSentiment = useMemo(() => courseSentimentByNorm(feedback), [feedback]);

  // Compute swap candidates for the selected event after the drawer animates in
  // (the catalogue scan is synchronous and can hitch the open transition). The
  // shared `computeSwapOptions` core runs against the exact term cache the
  // generator used so suggestions keep every other class at its current section.
  const activeVariant = variants[index];
  useEffect(() => {
    if (status !== "ready" || !activeVariant) return;
    analytics.capture("schedule_viewed", { index: index + 1, total: variants.length });
  }, [activeVariant, analytics, index, status, variants.length]);

  // Distinct week patterns of the active variant. Consecutive weeks with the
  // same timetable collapse into one group, so most variants yield a single
  // group (every week identical) and only date-bounded sections (labs starting
  // late, reading-week gaps) split the term into navigable weeks.
  const { groups: weekGroups, busiestIndex } = useMemo(
    () =>
      activeVariant
        ? computeWeekGroups(activeVariant.schedule)
        : { groups: [] as WeekGroup[], busiestIndex: 0 },
    [activeVariant],
  );
  // Reset to the busiest week whenever the active variant (and thus its week
  // groups) changes, so each new schedule opens on its fullest week.
  useEffect(() => {
    setWeekIndex(busiestIndex);
  }, [busiestIndex, activeVariant]);
  const hasWeekNav = weekGroups.length > 1;
  const currentWeek = hasWeekNav ? (weekGroups[weekIndex] ?? null) : null;

  const basketCodes = basket.codes;
  const completedCodes = completed.codes;
  useEffect(() => {
    if (!selected) {
      setSwap({ loading: false, options: [] });
      return;
    }
    const schedules = termId ? schedulesByTerm.get(termId) : undefined;
    if (!activeVariant || !schedules) {
      setSwap({ loading: false, options: [] });
      return;
    }
    setSwap({ loading: true, options: [] });
    let cancelled = false;
    // Defer the (synchronous) catalogue scan past the drawer's open animation
    // (~240ms) so suggestions compute without dropping frames on the slide-in.
    const handle = setTimeout(() => {
      if (cancelled) return;
      const result = computeSwapOptions({
        dataset: {
          catalogue: bundle.catalogue,
          disciplines: bundle.disciplines,
          faculties: bundle.faculties,
          grades: bundle.grades,
          ratings: bundle.ratings,
        },
        schedules,
        variant: activeVariant,
        courseCode: selected.event.courseCode,
        options,
        basketCodes,
        completedCourses: completedCodes,
        courseSentimentByNorm: courseSentiment,
      });
      if (!cancelled) setSwap({ loading: false, options: result.options });
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [
    selected,
    activeVariant,
    termId,
    schedulesByTerm,
    bundle,
    options,
    basketCodes,
    completedCodes,
    courseSentiment,
  ]);

  const handleSwap = useCallback(
    (newCode: string) => {
      const oldCode = selected?.event.courseCode;
      if (oldCode) {
        const norm = normalizeCourseCode(oldCode);
        const stored = basket.codes.find((c) => normalizeCourseCode(c) === norm);
        if (stored) basket.remove(stored);
      }
      basket.add(newCode);
      analytics.capture("schedule_swapped_course", { courseCode: newCode });
      setSelected(null);
    },
    [selected, basket, analytics],
  );

  const events = variants[index]?.events ?? [];
  // The calendar shows only the selected week's meetings; whole-term slots always
  // appear. The ICS/add-to-calendar args below keep the FULL term events.
  const displayedEvents = useMemo(() => eventsForWeek(events, currentWeek), [events, currentWeek]);
  const calendarArgs = useMemo(
    () => ({
      events,
      startDate: TERM_START_DATE,
      endDate: TERM_END_DATE,
      titleFor: (courseCode: string) => titleByCode.get(normalizeCourseCode(courseCode)),
    }),
    [events, titleByCode],
  );

  // The floating control bar sits just above the native tab bar; the calendar
  // fills the space between the safe-area top and the control bar so it never
  // scrolls off the page. Both the control bar and the cart FAB use the SAME
  // platform-aware bottom offset (`useFloatingControlsBottom`) so they rest on a
  // single baseline instead of floating at different heights.
  const controlBarBottom = useFloatingControlsBottom();
  // Reserve a top strip for the floating global-settings button so the calendar
  // header never sits beneath it.
  const calendarTop = insets.top + Spacing.two + SETTINGS_BUTTON + Spacing.two;
  const calendarHeight = useMemo(
    () =>
      height -
      calendarTop -
      controlBarBottom -
      CONTROL_BAR_HEIGHT -
      Spacing.three -
      (hasWeekNav ? WEEK_PAGER_BLOCK : 0),
    [height, calendarTop, controlBarBottom, hasWeekNav],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportScheduleIcs(calendarArgs);
      analytics.capture("schedule_exported", { target: "ics" });
    } catch {
      // User dismissed the share sheet, or export failed — nothing to surface.
    } finally {
      setExporting(false);
    }
  };

  const handleAddToCalendar = async () => {
    setAddingToCalendar(true);
    try {
      const result = await addScheduleToCalendar(calendarArgs);
      if (result.status === "permission-denied") {
        Alert.alert(
          "Calendar access needed",
          "Allow calendar access to add your schedule directly, or use Export to calendar (.ics) to import it manually.",
        );
        return;
      }

      analytics.capture("schedule_exported", { target: "calendar" });
      Alert.alert(
        "Added to calendar",
        `Added ${result.createdCount} recurring meeting${
          result.createdCount === 1 ? "" : "s"
        } to the ${result.calendarTitle} calendar.`,
      );
    } catch {
      Alert.alert(
        "Couldn’t add to calendar",
        "Try Export to calendar (.ics) to import your schedule manually.",
      );
    } finally {
      setAddingToCalendar(false);
    }
  };

  const openPersonalize = () => {
    setPrefsOpen(false);
    router.navigate("/personalize");
  };

  const handleBlockedTimesChange = useCallback(
    (blockedTimes: BlockedTimeWindow[]) => setOptions({ blockedTimes }),
    [setOptions],
  );

  return (
    <View style={styles.root}>
      {status === "ready" ? (
        <View
          style={{
            paddingTop: calendarTop,
            paddingHorizontal: Spacing.two,
          }}
        >
          <WeekCalendar
            events={displayedEvents}
            availableHeight={calendarHeight}
            blockedTimes={options.blockedTimes}
            onBlockedTimesChange={handleBlockedTimesChange}
            onEventPress={(event, color) => {
              setSelected({ event, color });
              setSwap({ loading: true, options: [] });
            }}
          />
        </View>
      ) : (
        <ScheduleEmptyState
          status={status}
          diagnostics={diagnostics ?? null}
          skippedCourses={skippedCourses ?? []}
          basketCount={count}
          paddingTop={insets.top}
          onBrowse={() => router.push("/explore")}
          onAdjustFilters={() => setPrefsOpen(true)}
          onRetry={regenerate}
        />
      )}

      {status === "ready" && variants.length > 0 ? (
        <BottomControlBar
          bottom={controlBarBottom}
          onSettings={() => setPrefsOpen(true)}
          label={`Schedule ${index + 1}`}
          onPrev={prev}
          onNext={next}
          prevDisabled={!hasPrev}
          nextDisabled={!hasNext}
          nextLoading={loadingMore}
          weekLabel={hasWeekNav ? weekPagerLabel(weekIndex, weekGroups.length) : undefined}
          onWeekPrev={() => setWeekIndex((w) => Math.max(0, w - 1))}
          onWeekNext={() => setWeekIndex((w) => Math.min(weekGroups.length - 1, w + 1))}
          weekPrevDisabled={weekIndex === 0}
          weekNextDisabled={weekIndex >= weekGroups.length - 1}
        />
      ) : null}

      <ScheduleSettingsSheet
        opened={prefsOpen}
        onClose={() => setPrefsOpen(false)}
        basketCount={count}
        onPersonalize={openPersonalize}
        onAddToCalendar={() => void handleAddToCalendar()}
        addingToCalendar={addingToCalendar}
        onExport={() => void handleExport()}
        exporting={exporting}
        hasProgram={Boolean(personalization.programUrl)}
      />

      <CalendarEventDrawer
        event={selected?.event ?? null}
        accentColor={selected?.color}
        courseTitle={
          selected ? titleByCode.get(normalizeCourseCode(selected.event.courseCode)) : undefined
        }
        swapOptions={swap.options}
        swapLoading={swap.loading}
        onSwap={handleSwap}
        onClose={() => setSelected(null)}
        onViewCourse={(code) =>
          router.push({ pathname: "/explore/course/[code]", params: { code } })
        }
      />
    </View>
  );
}

/** Split skipped courses by reason and build short, accurate phrases for each. */
function skipPhrases(courses: SkippedCourse[]): string[] {
  const prereq = courses.filter((c) => c.reason === "prerequisite").map((c) => c.code);
  const offering = courses.filter((c) => c.reason === "offering").map((c) => c.code);
  const phrases: string[] = [];
  if (prereq.length > 0) {
    phrases.push(`${prereq.join(", ")} — you don’t meet the prerequisites yet`);
  }
  if (offering.length > 0) {
    phrases.push(`${offering.join(", ")} — no open sections this term`);
  }
  return phrases;
}

/** A compact list of basket courses that couldn't be placed, with a short why. */
function SkippedCoursesNotice({ courses }: { courses: SkippedCourse[] }) {
  const single = courses.length === 1;
  return (
    <View style={styles.skipNotice}>
      <View style={styles.skipNoticeHead}>
        <AppIcon name="exclamationmark.circle" size={15} color={Surface.dimmed} />
        <Text dimmed size="sm" weight="medium">
          Left out this term
        </Text>
      </View>
      <View style={styles.skipChips}>
        {courses.map((c) => (
          <View key={c.code} style={styles.skipChip}>
            <Text size="sm" weight="medium">
              {c.code}
            </Text>
          </View>
        ))}
      </View>
      {skipPhrases(courses).map((phrase) => (
        <Text key={phrase} dimmed size="sm" align="center">
          {phrase}
        </Text>
      ))}
      <Text dimmed size="sm" align="center">
        We built your schedule without {single ? "it" : "them"}.
      </Text>
    </View>
  );
}

/** Centered states for when there is no schedule to show. */
function ScheduleEmptyState({
  status,
  diagnostics,
  skippedCourses,
  basketCount,
  paddingTop,
  onBrowse,
  onAdjustFilters,
  onRetry,
}: {
  status: "empty" | "generating" | "none" | "error";
  diagnostics: TimetableFailureDiagnostics | null;
  skippedCourses: SkippedCourse[];
  basketCount: number;
  paddingTop: number;
  onBrowse: () => void;
  onAdjustFilters: () => void;
  onRetry: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const tips =
    status === "none" && diagnostics
      ? formatSuggestions(diagnostics).filter((t) => t.trim().length > 0)
      : [];
  // Everything in the basket was unschedulable this term (each course skipped),
  // so there is no conflict to "adjust" — just tell the user plainly why.
  const allSkipped = status === "none" && !diagnostics && skippedCourses.length > 0;
  const allSkippedHeading = (() => {
    const hasPrereq = skippedCourses.some((c) => c.reason === "prerequisite");
    const hasOffering = skippedCourses.some((c) => c.reason === "offering");
    const single = skippedCourses.length === 1;
    if (hasPrereq && !hasOffering) return "You don’t meet the prerequisites yet";
    if (hasOffering && !hasPrereq) {
      return single
        ? "That course isn’t offered this term"
        : "Those courses aren’t offered this term";
    }
    return single ? "That course can’t be scheduled yet" : "Those courses can’t be scheduled yet";
  })();
  return (
    <View style={[styles.center, { paddingTop: paddingTop + 120 }]}>
      {status === "generating" ? (
        <>
          <ActivityIndicator color={Surface.accent} />
          <Text dimmed align="center">
            Generating conflict-free timetables…
          </Text>
        </>
      ) : status === "none" ? (
        <>
          <View style={styles.iconBadge}>
            <AppIcon name="calendar.badge.exclamationmark" size={26} color={Surface.dimmed} />
          </View>
          <Text weight="bold" align="center">
            {allSkipped
              ? allSkippedHeading
              : diagnostics
                ? formatGenerationLead(diagnostics.lead)
                : "No conflict-free schedule"}
          </Text>
          {skippedCourses.length > 0 ? <SkippedCoursesNotice courses={skippedCourses} /> : null}
          {!allSkipped ? (
            <View style={styles.copy}>
              {tips.length > 0 ? (
                <View style={styles.tips}>
                  {tips.map((tip) => (
                    <View key={tip} style={styles.tipRow}>
                      <AppIcon name="arrow.right" size={13} color={Surface.dimmed} />
                      <View style={styles.tipText}>
                        <Text dimmed size="sm">
                          {tip}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              ) : (
                <Text dimmed align="center">
                  {basketCount} basket course{basketCount === 1 ? "" : "s"} can&apos;t all be
                  scheduled together this term. Try relaxing your filters.
                </Text>
              )}
            </View>
          ) : null}
          <View style={styles.actions}>
            {allSkipped ? (
              <PillButton
                label="Browse courses"
                variant="primary"
                icon="magnifyingglass"
                onPress={onBrowse}
              />
            ) : (
              <PillButton
                label="Adjust filters"
                variant="primary"
                icon="slider.horizontal.3"
                onPress={onAdjustFilters}
              />
            )}
            {!allSkipped && diagnostics ? (
              <PillButton
                label="View details"
                variant="secondary"
                onPress={() => {
                  getAnalytics().capture("generation_error_details_opened", {
                    kind: diagnostics.lead.code,
                  });
                  setDetailsOpen(true);
                }}
              />
            ) : null}
          </View>
        </>
      ) : status === "error" ? (
        <>
          <View style={styles.iconBadge}>
            <AppIcon name="exclamationmark.triangle" size={26} color={Surface.dimmed} />
          </View>
          <Text weight="bold" align="center">
            Couldn&apos;t generate a schedule
          </Text>
          <PillButton label="Try again" variant="primary" onPress={onRetry} />
        </>
      ) : (
        <>
          <View style={styles.iconBadge}>
            <AppIcon name="calendar" size={26} color={Surface.accent} />
          </View>
          <Text weight="bold" align="center">
            Build your timetable
          </Text>
          <View style={styles.copy}>
            <Text dimmed align="center">
              Add courses from the explorer and uoplan builds conflict-free weekly schedules for
              you.
            </Text>
          </View>
          <View style={styles.actions}>
            <PillButton
              label="Browse courses"
              variant="primary"
              icon="magnifyingglass"
              onPress={onBrowse}
            />
          </View>
        </>
      )}
      <GenerationErrorDetailsSheet
        visible={detailsOpen}
        diagnostics={diagnostics}
        onClose={() => setDetailsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Surface.page,
  },
  center: {
    flex: 1,
    alignItems: "center",
    gap: Spacing.three,
    paddingHorizontal: Spacing.five,
  },
  iconBadge: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  copy: {
    maxWidth: 320,
  },
  tips: {
    gap: Spacing.one,
  },
  tipRow: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  tipText: {
    flex: 1,
  },
  actions: {
    alignItems: "center",
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  skipNotice: {
    width: "100%",
    maxWidth: 360,
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: 16,
    backgroundColor: Surface.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    alignItems: "center",
  },
  skipNoticeHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  skipChips: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: Spacing.one,
  },
  skipChip: {
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one / 2,
    borderRadius: 999,
    backgroundColor: Surface.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
});
