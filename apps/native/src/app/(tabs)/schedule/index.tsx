import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { courseSentimentByNorm } from "@uoplan/core/feedback";
import type { TimetableFailureDiagnostics } from "@uoplan/core/generationDiagnostics";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";
import type { CalendarEvent } from "@uoplan/calendar/types";
import type { BlockedTimeWindow } from "@uoplan/core";

import { Button, Text } from "@uoplan/ui";

import { AppIcon } from "@/components/app-icon";
import { CalendarEventDrawer } from "@/components/calendar-event-drawer";
import { BottomControlBar, GlassIconButton } from "@/components/redesign";
import { PillButton } from "@/components/redesign/pill-button";
import { BasketHeaderButton } from "@/components/basket-header-button";
import { ScheduleSettingsSheet } from "@/components/schedule-settings-sheet";
import { WeekCalendar } from "@/components/week-calendar";
import { Spacing, Surface } from "@/constants/theme";
import { useAppData } from "@/data/data-provider";
import { useBasket } from "@/data/basket-provider";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { addScheduleToCalendar } from "@/lib/add-to-calendar";
import { exportScheduleIcs } from "@/lib/share-ics";
import { computeSwapOptions, type SwapOption } from "@/lib/swap-course";
import { formatGenerationLead, formatSuggestions } from "@/lib/generation-messages";
import { useScheduleGeneration } from "@/lib/use-schedule-generation";

/** Height of the floating {@link BottomControlBar} pill (gear + pager). */
const CONTROL_BAR_HEIGHT = 48;

/** Diameter of the floating global-settings glass button (top-right header). */
const SETTINGS_BUTTON = 40;
const TERM_START_DATE = "2025-09-03";
const TERM_END_DATE = "2025-12-05";

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
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const basket = useBasket();
  const { count } = basket;
  const { bundle, schedulesByTerm, feedback } = useAppData();
  const { options, setOptions } = useScheduleOptions();
  const { status, variants, termId, diagnostics, regenerate } = useScheduleGeneration();

  const [variant, setVariant] = useState(0);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const [selected, setSelected] = useState<{ event: CalendarEvent; color: string } | null>(null);
  const [swap, setSwap] = useState<{ loading: boolean; options: SwapOption[] }>({
    loading: false,
    options: [],
  });
  const [exporting, setExporting] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  const titleByCode = useMemo(
    () => new Map(bundle.catalogue.courses.map((c) => [c.code, c.title] as const)),
    [bundle],
  );

  const courseSentiment = useMemo(() => courseSentimentByNorm(feedback), [feedback]);

  // Keep the paging index in range as the variant set changes.
  useEffect(() => {
    setVariant((v) => (v >= variants.length ? 0 : v));
  }, [variants.length]);

  // Compute swap candidates for the selected event after the drawer animates in
  // (the catalogue scan is synchronous and can hitch the open transition). The
  // shared `computeSwapOptions` core runs against the exact term cache the
  // generator used so suggestions keep every other class at its current section.
  const activeVariant = variants[variant];
  const basketCodes = basket.codes;
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
      setSelected(null);
    },
    [selected, basket],
  );

  const events = variants[variant]?.events ?? [];
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
  // scrolls off the page. NOTE: with the iOS native (floating) tab bar,
  // `insets.bottom` already clears the tab bar, so we only add a small gap — no
  // extra BottomTabInset (that double-counts the bar and floats the controls up).
  const controlBarBottom = insets.bottom + Spacing.two;
  // Reserve a top strip for the floating global-settings button so the calendar
  // header never sits beneath it.
  const calendarTop = insets.top + Spacing.two + SETTINGS_BUTTON + Spacing.two;
  const calendarHeight = useMemo(
    () => height - calendarTop - controlBarBottom - CONTROL_BAR_HEIGHT - Spacing.three,
    [height, calendarTop, controlBarBottom],
  );

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportScheduleIcs(calendarArgs);
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
      <View style={[styles.headerCluster, { top: insets.top + Spacing.two }]}>
        <BasketHeaderButton />
        <GlassIconButton
          icon="gearshape"
          accessibilityLabel="Settings"
          onPress={() => router.push("/more")}
        />
      </View>
      {status === "ready" ? (
        <View
          style={{
            paddingTop: calendarTop,
            paddingHorizontal: Spacing.two,
          }}
        >
          <WeekCalendar
            events={events}
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
          basketCount={count}
          paddingTop={insets.top}
          onBrowse={() => router.push("/explore")}
          onOpenBasket={() => router.push("/schedule/basket")}
          onRetry={regenerate}
        />
      )}

      {status === "ready" && variants.length > 0 ? (
        <BottomControlBar
          bottom={controlBarBottom}
          onSettings={() => setPrefsOpen(true)}
          label={`${variant + 1} / ${variants.length}`}
          onPrev={() => setVariant((v) => Math.max(0, v - 1))}
          onNext={() => setVariant((v) => Math.min(variants.length - 1, v + 1))}
          prevDisabled={variant === 0}
          nextDisabled={variant === variants.length - 1}
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

/** Centered states for when there is no schedule to show. */
function ScheduleEmptyState({
  status,
  diagnostics,
  basketCount,
  paddingTop,
  onBrowse,
  onOpenBasket,
  onRetry,
}: {
  status: "empty" | "generating" | "none" | "error";
  diagnostics: TimetableFailureDiagnostics | null;
  basketCount: number;
  paddingTop: number;
  onBrowse: () => void;
  onOpenBasket: () => void;
  onRetry: () => void;
}) {
  const tips = status === "none" && diagnostics ? formatSuggestions(diagnostics) : [];
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
            {diagnostics ? formatGenerationLead(diagnostics.lead) : "No conflict-free schedule"}
          </Text>
          <View style={styles.copy}>
            {tips.length > 0 ? (
              <View style={styles.tips}>
                {tips.map((tip) => (
                  <View key={tip} style={styles.tipRow}>
                    <Text dimmed>•</Text>
                    <View style={styles.tipText}>
                      <Text dimmed>{tip}</Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : (
              <Text dimmed align="center">
                {basketCount} basket course{basketCount === 1 ? "" : "s"} can&apos;t all be
                scheduled together this term. Try removing one.
              </Text>
            )}
          </View>
          <View style={styles.actions}>
            <PillButton
              label="Edit basket"
              variant="secondary"
              icon="cart"
              onPress={onOpenBasket}
            />
            <PillButton label="Try again" variant="primary" onPress={onRetry} />
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
            {basketCount > 0 ? (
              <PillButton
                label="Open basket"
                variant="secondary"
                icon="cart"
                onPress={onOpenBasket}
              />
            ) : null}
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Surface.page,
  },
  headerCluster: {
    position: "absolute",
    right: Spacing.three,
    zIndex: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
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
});
