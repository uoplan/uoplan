import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DAY_LABELS, FULL_WEEK_CODES } from "@uoplan/calendar/layout";
import type { DayOfWeek } from "@uoplan/core/dataTypes";

import { AppIcon } from "@/components/app-icon";
import { NotificationToggle } from "@/components/notification-toggle";
import { PillButton } from "@/components/redesign/pill-button";
import { ACTIVE_SCHEME, Fonts, Spacing, Surface } from "@/constants/theme";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";
import { formatTimeLabel, type ScheduleOptions } from "@/lib/schedule-options";

const TRACK_OFF = ACTIVE_SCHEME === "dark" ? "#3a3a3c" : "#d9d4cc";
const FORM_SHEET_MAX_WIDTH = 540;
const FORM_SHEET_MARGIN = Spacing.four;
const FORM_SHEET_MAX_HEIGHT_RATIO = 0.88;

const EARLIEST_MIN = 6 * 60;
const EARLIEST_MAX = 12 * 60;
const LATEST_MIN = 14 * 60;
const LATEST_MAX = 23 * 60;
const STEP = 30;

/** Minimum-professor-rating presets (null = no minimum). */
const RATING_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: "Any" },
  { value: 2, label: "2.0+" },
  { value: 2.5, label: "2.5+" },
  { value: 3, label: "3.0+" },
  { value: 3.5, label: "3.5+" },
  { value: 4, label: "4.0+" },
  { value: 4.5, label: "4.5+" },
];

interface ScheduleSettingsSheetProps {
  opened: boolean;
  onClose: () => void;
  /** Number of basket courses driving generation (for the contextual header). */
  basketCount: number;
  /** Open the personalize wizard (requirement-based generation). */
  onPersonalize: () => void;
  /** Add the visible schedule directly to the user's device calendar. */
  onAddToCalendar: () => void;
  addingToCalendar?: boolean;
  /** Export the visible schedule to an .ics file / share sheet. */
  onExport: () => void;
  exporting: boolean;
}

/**
 * Native schedule-settings bottom sheet — the native analogue of the web
 * generation-options panel (`GenerationOptionsFields`, basic mode). Surfaces the
 * SAME options the web exposes and drives generation through them: time window,
 * avoided days, compressed schedule, prefer-easier / prefer-better-feedback,
 * minimum professor rating, and closed / virtual-only section filters — all
 * persisted via {@link useScheduleOptions}. A contextual header reflects the
 * basket (basic mode) and links to Personalize for requirement-based schedules.
 */
export function ScheduleSettingsSheet({
  opened,
  onClose,
  basketCount,
  onPersonalize,
  onAddToCalendar,
  addingToCalendar = false,
  onExport,
  exporting,
}: ScheduleSettingsSheetProps) {
  const { options, setOptions, reset } = useScheduleOptions();
  const { width, height, formSheet } = useAdaptiveLayout();
  const insets = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(opened);

  useEffect(() => {
    if (opened) {
      setMounted(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (mounted) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setMounted(false);
      });
    }
  }, [opened, mounted, progress]);

  const set = <K extends keyof ScheduleOptions>(key: K, value: ScheduleOptions[K]) =>
    setOptions({ [key]: value });

  const toggleDay = (day: DayOfWeek) => {
    const has = options.avoidedDays.includes(day);
    set(
      "avoidedDays",
      has ? options.avoidedDays.filter((d) => d !== day) : [...options.avoidedDays, day],
    );
  };

  const translateY = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [height, 0],
  });
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1] });
  const formSheetWidth = Math.max(0, Math.min(FORM_SHEET_MAX_WIDTH, width - FORM_SHEET_MARGIN * 2));
  const formSheetMaxHeight = Math.max(
    0,
    Math.min(height * FORM_SHEET_MAX_HEIGHT_RATIO, height - FORM_SHEET_MARGIN * 2),
  );

  return (
    <Modal visible={mounted} transparent animationType="none" onRequestClose={onClose}>
      <View style={[styles.root, formSheet ? styles.formSheetRoot : null]}>
        <Animated.View style={[styles.backdrop, { opacity: progress }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <Animated.View
          style={[
            styles.sheet,
            formSheet
              ? {
                  width: formSheetWidth,
                  maxHeight: formSheetMaxHeight,
                  opacity: progress,
                  transform: [{ scale }],
                }
              : { transform: [{ translateY }] },
            formSheet ? styles.formSheet : null,
          ]}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <Text style={styles.title}>Schedule options</Text>
            <Pressable onPress={reset} hitSlop={8}>
              <Text style={styles.reset}>Reset</Text>
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Contextual header — basic (basket) mode + personalize CTA. */}
            <Pressable style={styles.context} onPress={onPersonalize}>
              <View style={{ flex: 1 }}>
                <Text style={styles.contextTitle}>
                  {basketCount > 0
                    ? `Generating from your basket (${basketCount} course${basketCount === 1 ? "" : "s"})`
                    : "Add courses to your basket"}
                </Text>
                <Text style={styles.contextSub}>
                  Pick a program & completed courses to generate requirement-based schedules
                </Text>
              </View>
              <AppIcon name="chevron.right" size={14} color={Surface.dimmed} />
            </Pressable>

            {/* Time window */}
            <Section title="Time window">
              <Stepper
                label="Earliest class start"
                value={options.minStartMinutes}
                min={EARLIEST_MIN}
                max={EARLIEST_MAX}
                onChange={(v) => set("minStartMinutes", v)}
              />
              <Stepper
                label="Latest class end"
                value={options.maxEndMinutes}
                min={LATEST_MIN}
                max={LATEST_MAX}
                onChange={(v) => set("maxEndMinutes", v)}
              />
            </Section>

            {/* Avoided days */}
            <Section
              title="Days to avoid"
              description="No classes will be scheduled on the days you select."
            >
              <View style={styles.dayRow}>
                {FULL_WEEK_CODES.map((day) => {
                  const active = options.avoidedDays.includes(day);
                  return (
                    <Pressable
                      key={day}
                      onPress={() => toggleDay(day)}
                      style={[styles.dayChip, active && styles.dayChipActive]}
                    >
                      <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                        {DAY_LABELS[day].slice(
                          0,
                          day === "Th" || day === "Su" || day === "Sa" ? 2 : 1,
                        )}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            {/* Minimum professor rating */}
            <Section
              title="Minimum professor rating"
              description="Professors without a rating are always allowed."
            >
              <View style={styles.pillRow}>
                {RATING_OPTIONS.map((opt) => {
                  const active = options.minProfessorRating === opt.value;
                  return (
                    <Pressable
                      key={opt.label}
                      onPress={() => set("minProfessorRating", opt.value)}
                      style={[styles.pill, active && styles.pillActive]}
                    >
                      <Text style={[styles.pillText, active && styles.pillTextActive]}>
                        {opt.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </Section>

            {/* Preferences */}
            <Section title="Preferences">
              <ToggleRow
                label="Compressed schedule"
                description="At most one break per day, up to 90 minutes."
                value={options.compressedSchedule}
                onChange={(v) => set("compressedSchedule", v)}
              />
              <ToggleRow
                label="Prefer easier courses"
                description="Courses with higher past A+ rates are more likely to be picked."
                value={options.preferEasier}
                onChange={(v) => set("preferEasier", v)}
              />
              <ToggleRow
                label="Prefer courses with better feedback"
                description="Courses with higher student-feedback ratings are more likely to be picked."
                value={options.preferHigherSentiment}
                onChange={(v) => set("preferHigherSentiment", v)}
              />
            </Section>

            {/* Section filters */}
            <Section title="Section filters">
              <ToggleRow
                label="Include closed sections"
                value={options.includeClosedComponents}
                onChange={(v) => set("includeClosedComponents", v)}
              />
              <ToggleRow
                label="Virtual meeting times only"
                value={options.virtualSectionsOnly}
                onChange={(v) => set("virtualSectionsOnly", v)}
              />
            </Section>

            {/* Reminders */}
            <Section title="Reminders">
              <NotificationToggle />
            </Section>
          </ScrollView>

          {/* Pinned calendar actions — fixed footer that clears the home
              indicator and sits over the tab bar at the very bottom. */}
          <View
            style={[
              styles.footer,
              { paddingBottom: (formSheet ? 0 : insets.bottom) + Spacing.three },
            ]}
          >
            <PillButton
              label={addingToCalendar ? "Adding…" : "Add to calendar"}
              variant="primary"
              icon="calendar.badge.plus"
              disabled={addingToCalendar}
              onPress={onAddToCalendar}
            />

            <PillButton
              label={exporting ? "Exporting…" : "Export to calendar (.ics)"}
              variant="secondary"
              icon="square.and.arrow.up"
              disabled={exporting}
              onPress={onExport}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {description ? <Text style={styles.sectionDesc}>{description}</Text> : null}
      <View style={styles.sectionBody}>{children}</View>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDesc}>{description}</Text> : null}
      </View>
      <RNSwitch
        value={value}
        onValueChange={onChange}
        trackColor={{ true: Surface.accent, false: TRACK_OFF }}
        ios_backgroundColor={TRACK_OFF}
      />
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - STEP));
  const inc = () => onChange(Math.min(max, value + STEP));
  return (
    <View style={styles.stepperRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable
          onPress={dec}
          disabled={value <= min}
          style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
        >
          <AppIcon name="minus" size={13} color={Surface.label} />
        </Pressable>
        <Text style={styles.stepValue}>{formatTimeLabel(value)}</Text>
        <Pressable
          onPress={inc}
          disabled={value >= max}
          style={[styles.stepBtn, value >= max && styles.stepBtnDisabled]}
        >
          <AppIcon name="plus" size={13} color={Surface.label} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
  },
  formSheetRoot: {
    alignItems: "center",
    justifyContent: "center",
  },
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  sheet: {
    backgroundColor: Surface.page,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    maxHeight: "88%",
    paddingTop: Spacing.two,
  },
  formSheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 999,
    backgroundColor: Surface.border,
    marginBottom: Spacing.two,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Surface.label,
  },
  reset: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    color: Surface.accent,
  },
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.four,
    gap: Spacing.four,
  },
  context: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    backgroundColor: Surface.accentSoft,
    borderRadius: 14,
    padding: Spacing.three,
  },
  contextTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13.5,
    fontWeight: "700",
    color: Surface.label,
  },
  contextSub: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Surface.dimmed,
    marginTop: 2,
    lineHeight: 16,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    color: Surface.dimmed,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  sectionDesc: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Surface.dimmed,
    lineHeight: 16,
  },
  sectionBody: {
    gap: Spacing.three,
    marginTop: Spacing.one,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  toggleText: {
    flex: 1,
    minWidth: 0,
  },
  toggleLabel: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    fontWeight: "600",
    color: Surface.label,
  },
  toggleDesc: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Surface.dimmed,
    marginTop: 2,
    lineHeight: 16,
  },
  stepperRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.three,
  },
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  stepBtnDisabled: {
    opacity: 0.4,
  },
  stepValue: {
    fontFamily: Fonts.monoMedium,
    fontSize: 14,
    color: Surface.label,
    minWidth: 78,
    textAlign: "center",
  },
  dayRow: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  dayChip: {
    flex: 1,
    height: 38,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Surface.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  dayChipActive: {
    backgroundColor: Surface.accent,
    borderColor: Surface.accent,
  },
  dayChipText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: Surface.dimmed,
  },
  dayChipTextActive: {
    color: Surface.onAccent,
  },
  pillRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
  },
  pill: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: 999,
    backgroundColor: Surface.subtle,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
  },
  pillActive: {
    backgroundColor: Surface.accent,
    borderColor: Surface.accent,
  },
  pillText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12.5,
    color: Surface.dimmed,
  },
  pillTextActive: {
    color: Surface.onAccent,
  },
  scroll: {
    flexShrink: 1,
  },
  footer: {
    gap: Spacing.two,
    paddingTop: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
    backgroundColor: Surface.page,
  },
});
