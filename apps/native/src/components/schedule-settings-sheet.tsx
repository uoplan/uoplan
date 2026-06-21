import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text,
  UIManager,
  View,
} from "react-native";

import { DAY_LABELS, FULL_WEEK_CODES } from "@uoplan/calendar/layout";
import {
  analyzeFrenchImmersionProgress,
  completedCoursesIncludeFls3500,
  frenchImmersionOverallVolumePercent,
} from "@uoplan/core";
import { buildDataCache } from "@uoplan/core/dataCache";
import type { CourseLanguageBucket, CourseLevelBucket, DataCache } from "@uoplan/core";
import type { DayOfWeek } from "@uoplan/core/dataTypes";
import { normalizeCourseCode } from "@uoplan/core/utils/courseUtils";

import { AppIcon } from "@/components/app-icon";
import { NotificationToggle } from "@/components/notification-toggle";
import { PillButton } from "@/components/redesign/pill-button";
import { SearchableMultiSelect, type SearchableSelectOption } from "@/components/searchable-select";
import { ACTIVE_SCHEME, Fonts, Spacing, Surface } from "@/constants/theme";
import { useAppData } from "@/data/data-provider";
import { useBasket } from "@/data/basket-provider";
import { useCompletedCourses } from "@/data/completed-courses-provider";
import { useScheduleOptions } from "@/data/schedule-options-provider";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";
import {
  formatTimeLabel,
  SCHEDULE_COURSE_COUNT_MAX,
  type ScheduleOptions,
} from "@/lib/schedule-options";

// LayoutAnimation needs an opt-in on old-architecture Android; iOS supports it
// natively. Under Fabric the setter is a no-op that warns, so guard it.
const IS_FABRIC = Boolean(
  (globalThis as { nativeFabricUIManager?: unknown }).nativeFabricUIManager,
);
if (Platform.OS === "android" && !IS_FABRIC && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FIRST_YEAR_CREDIT_CAP = 48;

const LEVEL_BUCKET_OPTIONS: { value: CourseLevelBucket; label: string }[] = [
  { value: "undergrad", label: "Undergraduate" },
  { value: "grad", label: "Graduate" },
];
const LANGUAGE_BUCKET_OPTIONS: { value: CourseLanguageBucket; label: string }[] = [
  { value: "en", label: "English" },
  { value: "fr", label: "French" },
  { value: "other", label: "Other" },
];

const TRACK_OFF = ACTIVE_SCHEME === "dark" ? "#3a3a3c" : "#d9d4cc";
const KNOB_COLOR = "#ffffff";
const FORM_SHEET_MAX_WIDTH = 540;
const FORM_SHEET_MARGIN = Spacing.four;
const FORM_SHEET_MAX_HEIGHT_RATIO = 0.88;

const EARLIEST_MIN = 6 * 60;
const EARLIEST_MAX = 12 * 60;
const LATEST_MIN = 14 * 60;
const LATEST_MAX = 23 * 60;
const STEP = 30;

const ELECTIVE_LEVEL_PRESETS: { label: string; buckets: number[] }[] = [
  { label: "1000–2000", buckets: [1000, 2000] },
  { label: "1000–4000", buckets: [1000, 2000, 3000, 4000] },
  { label: "Any level", buckets: [1000, 2000, 3000, 4000, 5000, 6000] },
  { label: "Graduate 5000–6000", buckets: [5000, 6000] },
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
 * SAME options the web exposes and drives generation through them. Mirrors the
 * web sidebar layout: an always-visible course-count control + first-year
 * warning, a collapsible "Smart options" card (compressed, prefer-easier,
 * prefer-better-feedback, prefer-higher-professor-rating, first-year limit), and
 * a collapsible "Advanced options" card (time window, avoided days, level /
 * language buckets, elective levels, section filters, exclude subjects / courses,
 * French immersion + overview) — all persisted via {@link useScheduleOptions}.
 * A contextual header reflects the basket (basic mode) and links to Personalize
 * for requirement-based schedules.
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
  const { bundle, schedulesByTerm } = useAppData();
  const basket = useBasket();
  const completed = useCompletedCourses();
  const { width, height, formSheet } = useAdaptiveLayout();
  const progress = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(opened);
  const [footerHeight, setFooterHeight] = useState(0);

  // Credits keyed by normalized course code — drives the first-year warning
  // (mirrors the web `getCourseCredits`; defaults to 3 like the cache).
  const creditByNorm = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of bundle.catalogue.courses) m.set(normalizeCourseCode(c.code), c.credits ?? 3);
    return m;
  }, [bundle]);

  // First-year (1xxx) credits committed (completed + basket), deduped.
  const totalFirstYearCredits = useMemo(() => {
    const seen = new Set<string>();
    let total = 0;
    for (const code of [...completed.codes, ...basket.codes]) {
      const norm = normalizeCourseCode(code);
      if (seen.has(norm)) continue;
      seen.add(norm);
      const digits = norm.match(/\d{4}/);
      if (!digits || Number(digits[0]) >= 2000) continue;
      total += creditByNorm.get(norm) ?? 3;
    }
    return total;
  }, [completed.codes, basket.codes, creditByNorm]);

  // Subject categories (e.g. "CSI", "MAT") for the exclude-subjects picker.
  const subjectOptions = useMemo<SearchableSelectOption[]>(() => {
    const set = new Set<string>();
    for (const c of bundle.catalogue.courses) {
      const m = c.code.match(/^([A-Z]{3,4})/);
      if (m) set.add(m[1]);
    }
    return [...set].sort().map((value) => ({ value, label: value }));
  }, [bundle]);

  // Every course (code + title) for the exclude-courses picker.
  const courseOptions = useMemo<SearchableSelectOption[]>(() => {
    const seen = new Set<string>();
    const out: SearchableSelectOption[] = [];
    for (const c of bundle.catalogue.courses) {
      if (seen.has(c.code)) continue;
      seen.add(c.code);
      out.push({ value: c.code, label: c.code, description: c.title, searchText: c.title });
    }
    return out.sort((a, b) => a.value.localeCompare(b.value));
  }, [bundle]);

  // The French-immersion overview needs course credits/levels; build the cache
  // only while the stream is on so the default path avoids the work.
  const frenchCache = useMemo<DataCache | null>(() => {
    if (!options.frenchImmersionStream) return null;
    const schedules = schedulesByTerm.values().next().value;
    if (!schedules) return null;
    return buildDataCache(bundle.catalogue, schedules, {
      disciplines: bundle.disciplines,
      faculties: bundle.faculties,
    });
  }, [options.frenchImmersionStream, bundle, schedulesByTerm]);

  const additionalElectivesMin = basketCount > 0 ? 0 : 1;
  const additionalElectivesMax = Math.max(0, SCHEDULE_COURSE_COUNT_MAX - basketCount);

  // "Smart options" master toggle — mirrors the web tri-state checkbox: ON when
  // every soft preference is enabled, OFF when none are, and "mixed" otherwise.
  // The first-year credit cap only participates when there are 1000-level
  // credits to limit (same condition the web uses).
  const hasFirstYearCredits = totalFirstYearCredits > 0;
  const smartOptionValues = [
    options.compressedSchedule,
    options.preferEasier,
    options.preferHigherSentiment,
    options.preferHigherProfessorRating,
    ...(hasFirstYearCredits ? [options.limitFirstYearCredits] : []),
  ];
  const allSmartOn = smartOptionValues.every(Boolean);
  const smartState: TriState = allSmartOn
    ? "on"
    : smartOptionValues.some(Boolean)
      ? "mixed"
      : "off";
  const setAllSmartOptions = (on: boolean) =>
    setOptions({
      compressedSchedule: on,
      preferEasier: on,
      preferHigherSentiment: on,
      preferHigherProfessorRating: on,
      ...(hasFirstYearCredits ? { limitFirstYearCredits: on } : {}),
    });
  const smartSummary = [
    "Compressed schedule",
    "Easier courses",
    "Better course feedback",
    "Higher-rated professors",
    ...(hasFirstYearCredits ? ["1000-level credit cap"] : []),
  ];
  const advancedSummary = ["Class times", "Days to avoid", "Course filters", "French immersion"];

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
            contentContainerStyle={[styles.content, { paddingBottom: footerHeight + Spacing.two }]}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Contextual header — basic (basket) mode + personalize CTA. */}
            <View style={styles.contextGroup}>
              <View style={styles.context}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contextTitle}>
                    {basketCount > 0
                      ? `Generating from your basket (${basketCount} course${basketCount === 1 ? "" : "s"})`
                      : "Add courses to your basket"}
                  </Text>
                  <Text style={styles.contextSub}>
                    Use the cart to review or edit the courses used for basket schedules.
                  </Text>
                </View>
                <AppIcon name="cart" size={16} color={Surface.dimmed} />
              </View>
              <Pressable style={styles.personalizeLink} onPress={onPersonalize}>
                <Text style={styles.personalizeText}>Set up requirement-based schedules</Text>
                <AppIcon name="chevron.right" size={13} color={Surface.accent} />
              </Pressable>
            </View>

            {/* Course count — always visible. */}
            <Section title="Courses this term">
              <Stepper
                label="Electives this semester (additional)"
                value={options.basicElectivesCount}
                min={additionalElectivesMin}
                max={additionalElectivesMax}
                step={1}
                format={(v) => `${v}`}
                onChange={(v) => set("basicElectivesCount", v)}
              />
              {totalFirstYearCredits > FIRST_YEAR_CREDIT_CAP ? (
                <View style={styles.warning}>
                  <AppIcon name="exclamationmark.triangle" size={14} color={Surface.danger} />
                  <Text style={styles.warningText}>
                    Your selected courses may push your 1000-level credits to{" "}
                    {totalFirstYearCredits}/48, over the undergraduate limit. Keep "Limit 1000-level
                    credits" on to cap them at 48.
                  </Text>
                </View>
              ) : null}
            </Section>

            {/* Smart options — soft preferences. */}
            <CollapsibleCard
              title="Smart options"
              defaultOpen
              summary={smartSummary}
              leading={
                <TriStateToggle
                  state={smartState}
                  onPress={() => setAllSmartOptions(smartState !== "on")}
                />
              }
            >
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
              <ToggleRow
                label="Prefer professors with better ratings"
                description="Sections taught by higher-rated professors are more likely to be picked. Professors without a rating are treated as average."
                value={options.preferHigherProfessorRating}
                onChange={(v) => set("preferHigherProfessorRating", v)}
              />
              <ToggleRow
                label="Limit 1000-level courses to 48 credits"
                description={`You currently have ${totalFirstYearCredits} credit${
                  totalFirstYearCredits === 1 ? "" : "s"
                } of 1000-level courses (completed + selected). The undergraduate limit is 48.`}
                value={options.limitFirstYearCredits}
                onChange={(v) => set("limitFirstYearCredits", v)}
              />
            </CollapsibleCard>

            {/* Advanced options — hard filters. */}
            <CollapsibleCard
              title="Advanced options"
              summary={advancedSummary}
              leading={<AppIcon name="slider.horizontal.3" size={16} color={Surface.dimmed} />}
            >
              <SubSection title="Time window">
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
              </SubSection>

              <SubSection
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
              </SubSection>

              <SubSection title="Course levels">
                <ChipRow
                  options={LEVEL_BUCKET_OPTIONS}
                  selected={options.levelBuckets}
                  onToggle={(v) =>
                    set("levelBuckets", toggleInList(options.levelBuckets, v, LEVEL_BUCKET_OPTIONS))
                  }
                />
              </SubSection>

              <SubSection title="Languages">
                <ChipRow
                  options={LANGUAGE_BUCKET_OPTIONS}
                  selected={options.languageBuckets}
                  onToggle={(v) =>
                    set(
                      "languageBuckets",
                      toggleInList(options.languageBuckets, v, LANGUAGE_BUCKET_OPTIONS),
                    )
                  }
                />
              </SubSection>

              <SubSection
                title="Elective levels"
                description="Choose which course levels can fill open elective requirements."
              >
                <View style={styles.pillRow}>
                  {ELECTIVE_LEVEL_PRESETS.map((preset) => {
                    const active = sameBuckets(options.electiveLevelBuckets, preset.buckets);
                    return (
                      <Pressable
                        key={preset.label}
                        onPress={() => set("electiveLevelBuckets", [...preset.buckets])}
                        style={[styles.pill, active && styles.pillActive]}
                      >
                        <Text style={[styles.pillText, active && styles.pillTextActive]}>
                          {preset.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </SubSection>

              <SubSection title="Section filters">
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
              </SubSection>

              <SubSection
                title="Exclude subjects"
                description="Subjects you pick here are never used to fill electives."
              >
                <SearchableMultiSelect
                  title="Exclude subjects"
                  options={subjectOptions}
                  values={options.basicExcludedCategories}
                  onChange={(v) => set("basicExcludedCategories", v)}
                  placeholder="e.g. ADM, CSI"
                  searchPlaceholder="Search subjects"
                  emptyMessage="No subjects found"
                  clearable
                />
              </SubSection>

              <SubSection
                title="Excluded courses"
                description="Courses you pick here never appear in generated schedules."
              >
                <SearchableMultiSelect
                  title="Excluded courses"
                  options={courseOptions}
                  values={options.blacklistedCourses}
                  onChange={(v) => set("blacklistedCourses", v)}
                  placeholder="Add a course to exclude…"
                  searchPlaceholder="Search courses"
                  emptyMessage="No courses found"
                  clearable
                />
              </SubSection>

              <SubSection title="French immersion">
                <ToggleRow
                  label="French immersion stream"
                  description="Track progress toward the French immersion designation and keep French-taught courses available."
                  value={options.frenchImmersionStream}
                  onChange={(v) => set("frenchImmersionStream", v)}
                />
                {options.frenchImmersionStream ? (
                  <FrenchImmersionOverview cache={frenchCache} completedCodes={completed.codes} />
                ) : null}
              </SubSection>
            </CollapsibleCard>

            {/* Reminders */}
            <Section title="Reminders">
              <NotificationToggle />
            </Section>
          </ScrollView>

          {/* Floating calendar actions — pinned to the very bottom of the sheet
              with a transparent background so the scroll content slides beneath
              them. The scroll view reserves `footerHeight` of bottom padding so
              nothing is permanently hidden behind the buttons. */}
          <View
            onLayout={(e) => setFooterHeight(e.nativeEvent.layout.height)}
            style={[styles.footer, { paddingBottom: formSheet ? Spacing.three : Spacing.five }]}
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

type TriState = "on" | "off" | "mixed";

/**
 * A switch-style master control with three positions — the native analogue of
 * the web "Smart options" tri-state checkbox. The knob sits left (off), centre
 * (mixed) or right (on); the track tints accordingly. It owns its own touch
 * (nested inside the card header's expand Pressable) so tapping it toggles all
 * options without expanding/collapsing the card.
 */
function TriStateToggle({ state, onPress }: { state: TriState; onPress: () => void }) {
  const target = state === "on" ? 2 : state === "mixed" ? 1 : 0;
  const x = useRef(new Animated.Value(target)).current;
  useEffect(() => {
    Animated.timing(x, {
      toValue: target,
      duration: 160,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [target, x]);
  const translateX = x.interpolate({ inputRange: [0, 1, 2], outputRange: [0, 9, 18] });
  const trackColor =
    state === "on" ? Surface.accent : state === "mixed" ? Surface.accentSoft : TRACK_OFF;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="switch"
      accessibilityState={{ checked: state === "on" }}
      hitSlop={8}
      style={[styles.triTrack, { backgroundColor: trackColor }]}
    >
      <Animated.View style={[styles.triKnob, { transform: [{ translateX }] }]} />
    </Pressable>
  );
}

function Stepper({
  label,
  description,
  value,
  min,
  max,
  step = STEP,
  format = formatTimeLabel,
  onChange,
}: {
  label: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (v: number) => string;
  onChange: (v: number) => void;
}) {
  const dec = () => onChange(Math.max(min, value - step));
  const inc = () => onChange(Math.min(max, value + step));
  return (
    <View style={styles.stepperRow}>
      <View style={styles.toggleText}>
        <Text style={styles.toggleLabel}>{label}</Text>
        {description ? <Text style={styles.toggleDesc}>{description}</Text> : null}
      </View>
      <View style={styles.stepper}>
        <Pressable
          onPress={dec}
          disabled={value <= min}
          style={[styles.stepBtn, value <= min && styles.stepBtnDisabled]}
        >
          <AppIcon name="minus" size={13} color={Surface.label} />
        </Pressable>
        <Text style={styles.stepValue}>{format(value)}</Text>
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

/**
 * A titled, collapsible card grouping lower-priority options — the native
 * analogue of the web "Smart options" / "Advanced options" panels. The entire
 * collapsed state (header + summary bullets) is tappable to expand; an optional
 * `leading` slot (e.g. the Smart-options master toggle) owns its own touch so it
 * doesn't trigger expand/collapse. The open/close animates via
 * {@link LayoutAnimation}.
 */
function CollapsibleCard({
  title,
  defaultOpen = false,
  leading,
  summary,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  leading?: React.ReactNode;
  summary?: string[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((o) => !o);
  };
  return (
    <View style={[styles.card, open && styles.cardOpen]}>
      <Pressable
        onPress={toggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={styles.cardHeaderWrap}
      >
        <View style={styles.cardHeader}>
          {leading ? <View style={styles.cardLeading}>{leading}</View> : null}
          <Text style={styles.cardTitle}>{title}</Text>
          <AppIcon
            name={open ? "chevron.down" : "chevron.right"}
            size={13}
            color={Surface.dimmed}
          />
        </View>
        {!open && summary && summary.length > 0 ? (
          <View style={[styles.cardSummary, leading ? styles.cardSummaryIndent : null]}>
            {summary.map((item) => (
              <Text key={item} style={styles.cardSummaryItem}>
                • {item}
              </Text>
            ))}
          </View>
        ) : null}
      </Pressable>
      {open ? <View style={styles.cardBody}>{children}</View> : null}
    </View>
  );
}

/** A labelled group of controls inside a {@link CollapsibleCard}. */
function SubSection({
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

/** A row of multi-select toggle chips for a fixed set of string options. */
function ChipRow<T extends string>({
  options,
  selected,
  onToggle,
}: {
  options: readonly { value: T; label: string }[];
  selected: readonly T[];
  onToggle: (value: T) => void;
}) {
  return (
    <View style={styles.pillRow}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <Pressable
            key={option.value}
            onPress={() => onToggle(option.value)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * Compact French-immersion progress preview — the native adaptation of the web
 * `FrenchImmersionProgramOverview` (variant "compact"): a counts line, an
 * overall-volume percentage + bar, and an FLS 3500 reminder when missing.
 */
function FrenchImmersionOverview({
  cache,
  completedCodes,
}: {
  cache: DataCache | null;
  completedCodes: readonly string[];
}) {
  const progress = useMemo(
    () =>
      analyzeFrenchImmersionProgress(
        completedCodes.map((c) => normalizeCourseCode(c)),
        cache,
      ),
    [completedCodes, cache],
  );
  const pct = frenchImmersionOverallVolumePercent(progress);
  const showFls3500 = !completedCoursesIncludeFls3500([...completedCodes]);
  return (
    <View style={styles.french}>
      <View style={styles.frenchRow}>
        <Text style={styles.frenchLine}>
          {`${progress.countedCourses}/${progress.requiredCourses} courses · ${progress.countedUnits}/${progress.requiredUnits} units`}
        </Text>
        <Text style={styles.frenchPct}>{pct}%</Text>
      </View>
      <View style={styles.frenchTrack}>
        <View
          style={[
            styles.frenchFill,
            {
              width: `${Math.min(100, pct)}%`,
              backgroundColor: progress.volumeMet ? Surface.accent : Surface.label,
            },
          ]}
        />
      </View>
      {showFls3500 ? (
        <Text style={styles.frenchHint}>
          Don't forget FLS 3500 — it's required for the immersion designation.
        </Text>
      ) : null}
    </View>
  );
}

/** Toggle a value in a fixed-option list, preserving the canonical option order. */
function toggleInList<T extends string>(
  current: readonly T[],
  value: T,
  order: readonly { value: T }[],
): T[] {
  const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
  return order.map((o) => o.value).filter((v) => next.includes(v));
}

function sameBuckets(a: readonly number[], b: readonly number[]): boolean {
  if (a.length !== b.length) return false;
  const values = new Set(a);
  return b.every((bucket) => values.has(bucket));
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
  contextGroup: {
    gap: Spacing.two,
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
  personalizeLink: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
    paddingHorizontal: Spacing.one,
    paddingVertical: Spacing.one,
  },
  personalizeText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 12,
    color: Surface.accent,
  },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: Surface.border,
    backgroundColor: Surface.subtle,
    overflow: "hidden",
  },
  cardOpen: {
    backgroundColor: Surface.card,
  },
  cardHeaderWrap: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
  },
  cardLeading: {
    width: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    flex: 1,
    fontFamily: Fonts.monoMedium,
    fontSize: 13.5,
    fontWeight: "700",
    color: Surface.label,
  },
  cardSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.two,
  },
  cardSummaryIndent: {
    paddingLeft: 44 + Spacing.two,
  },
  cardSummaryItem: {
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Surface.dimmed,
  },
  triTrack: {
    width: 44,
    height: 26,
    borderRadius: 999,
    paddingHorizontal: 2,
    flexDirection: "row",
    alignItems: "center",
  },
  triKnob: {
    width: 22,
    height: 22,
    borderRadius: 999,
    backgroundColor: KNOB_COLOR,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  cardBody: {
    paddingHorizontal: Spacing.three,
    paddingBottom: Spacing.three,
    gap: Spacing.four,
  },
  warning: {
    flexDirection: "row",
    gap: Spacing.two,
    alignItems: "flex-start",
    backgroundColor: Surface.dangerSoft,
    borderRadius: 12,
    padding: Spacing.three,
  },
  warningText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Surface.label,
    lineHeight: 16,
  },
  french: {
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  frenchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.two,
  },
  frenchLine: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 11.5,
    color: Surface.dimmed,
  },
  frenchPct: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11.5,
    color: Surface.dimmed,
  },
  frenchTrack: {
    height: 5,
    borderRadius: 999,
    backgroundColor: Surface.subtle,
    overflow: "hidden",
  },
  frenchFill: {
    height: 5,
    borderRadius: 999,
  },
  frenchHint: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Surface.danger,
    lineHeight: 15,
    marginTop: 2,
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
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    gap: Spacing.two,
    paddingTop: Spacing.two,
    paddingHorizontal: Spacing.four,
    // Floating action buttons: no bar/divider/background — the buttons sit
    // directly over the scrolling content, pinned to the bottom of the sheet.
    backgroundColor: "transparent",
  },
});
