import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DAY_LABELS } from "@uoplan/calendar/layout";
import type { CalendarEvent } from "@uoplan/calendar/types";

import { GradeHistogram } from "@/components/grade-histogram";
import { SwapCourseSection } from "@/components/swap-course-section";
import { Fonts, Spacing, Surface } from "@/constants/theme";
import { useAdaptiveLayout } from "@/lib/adaptive-layout";
import type { SwapOption } from "@/lib/swap-course";

const FORM_SHEET_MAX_WIDTH = 540;
const FORM_SHEET_MARGIN = Spacing.four;
const FORM_SHEET_MAX_HEIGHT_RATIO = 0.82;

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

interface CalendarEventDrawerProps {
  event: CalendarEvent | null;
  courseTitle?: string;
  accentColor?: string;
  onClose: () => void;
  onViewCourse: (code: string) => void;
  /** Alternative courses that fit the rest of the timetable (null = no swap UI). */
  swapOptions?: SwapOption[] | null;
  /** Whether the swap candidates are still being computed. */
  swapLoading?: boolean;
  /** Replace the clicked course with `code` (basket remove old + add new). */
  onSwap?: (code: string) => void;
}

/**
 * Native bottom-sheet analogue of the web calendar event popover/drawer
 * (`CalendarEventDetails` → `EventInfoSection`): read-only section/time,
 * satisfaction, RateMyProfessors ratings, instructor(s), and the full grade
 * distribution, with a link through to the course's explore page.
 */
export function CalendarEventDrawer({
  event,
  courseTitle,
  accentColor,
  onClose,
  onViewCourse,
  swapOptions = null,
  swapLoading = false,
  onSwap,
}: CalendarEventDrawerProps) {
  const { width, height, formSheet } = useAdaptiveLayout();
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState(() => event != null);
  const lastEvent = useRef<CalendarEvent | null>(event);

  useEffect(() => {
    if (event) {
      lastEvent.current = event;
      setShown(true);
      Animated.timing(progress, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (shown) {
      Animated.timing(progress, {
        toValue: 0,
        duration: 180,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) setShown(false);
      });
    }
  }, [event, shown, progress]);

  const active = event ?? lastEvent.current;
  if (!active) return null;

  const dot = accentColor ?? Surface.accent;
  const dayLabel = DAY_LABELS[active.day];
  const timeRange = `${formatTime(active.startMinutes)}–${formatTime(active.endMinutes)}`;
  const ratedInstructors = (active.professorRatingDetails ?? []).filter((d) => d.numRatings > 0);
  const hasProfessor = active.professor.trim() !== "" && active.professor !== "—";
  const hasSatisfaction = active.courseSentiment != null || active.professorSentiment != null;
  const grade = active.gradeViz && active.gradeViz.total > 0 ? active.gradeViz : null;

  // Backdrop fades in (opacity) while the sheet slides up (translateY); the
  // Modal itself uses animationType="none" so the dim layer never slides with
  // the sheet (matching the web overlay's fade-in). On iPad, the same progress
  // drives a centred form-sheet scale/fade instead of the phone bottom slide.
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
    <Modal visible={shown} transparent animationType="none" onRequestClose={onClose}>
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
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {/* Header */}
            <View style={styles.headerRow}>
              <View style={[styles.dot, { backgroundColor: dot }]} />
              <View style={styles.headerText}>
                <View style={styles.headerInline}>
                  <Text style={styles.code}>{active.courseCode}</Text>
                  {active.virtual ? <Text style={styles.virtual}>Online</Text> : null}
                </View>
                {courseTitle ? (
                  <Text style={styles.title} numberOfLines={2}>
                    {courseTitle}
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Section / time */}
            <View style={styles.block}>
              <InfoRow label="Section" value={active.componentSection} />
              <InfoRow label="When" value={`${dayLabel} · ${timeRange}`} />
            </View>

            {/* Satisfaction */}
            {hasSatisfaction ? (
              <View style={styles.block}>
                <SectionTitle>Satisfaction</SectionTitle>
                {active.courseSentiment != null ? (
                  <InfoRow label="Course" value={`${active.courseSentiment.toFixed(1)} / 5`} />
                ) : null}
                {active.professorSentiment != null ? (
                  <InfoRow
                    label="Professor"
                    value={`${active.professorSentiment.toFixed(1)} / 5`}
                  />
                ) : null}
              </View>
            ) : null}

            {/* RateMyProfessors */}
            {ratedInstructors.length > 0 ? (
              <View style={styles.block}>
                <SectionTitle>RateMyProfessors</SectionTitle>
                {ratedInstructors.map((d) => (
                  <InfoRow
                    key={d.name}
                    label={ratedInstructors.length > 1 ? d.name : "Rating"}
                    value={`${d.rating.toFixed(1).replace(/\.0$/, "")} (${d.numRatings})`}
                  />
                ))}
              </View>
            ) : null}

            {/* Instructor */}
            {hasProfessor ? (
              <View style={styles.block}>
                <InfoRow label="Instructor" value={active.professor} />
              </View>
            ) : null}

            {/* Grade distribution */}
            {grade ? (
              <View style={styles.block}>
                <SectionTitle>Grade distribution</SectionTitle>
                <GradeHistogram gradeViz={grade} maxBarPx={88} showStudentCount />
              </View>
            ) : null}

            {/* Swap course */}
            {onSwap && swapOptions ? (
              <SwapCourseSection options={swapOptions} loading={swapLoading} onSwap={onSwap} />
            ) : null}

            {/* View course */}
            <Pressable
              style={styles.viewCourse}
              onPress={() => {
                onClose();
                onViewCourse(active.courseCode);
              }}
            >
              <Text style={styles.viewCourseText}>View course →</Text>
            </Pressable>
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
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
    maxHeight: "82%",
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
  content: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.two,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 4,
    marginTop: 5,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  headerInline: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: Spacing.two,
  },
  code: {
    fontFamily: Fonts.monoMedium,
    fontSize: 18,
    fontWeight: "700",
    color: Surface.label,
    letterSpacing: -0.4,
  },
  virtual: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Surface.dimmed,
  },
  title: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Surface.dimmed,
    marginTop: 2,
    lineHeight: 17,
  },
  block: {
    gap: Spacing.one,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Surface.border,
    paddingTop: Spacing.three,
  },
  sectionTitle: {
    fontFamily: Fonts.monoMedium,
    fontSize: 11,
    fontWeight: "700",
    color: Surface.dimmed,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: Spacing.half,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    gap: Spacing.three,
  },
  rowLabel: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    color: Surface.dimmed,
    flexShrink: 0,
  },
  rowValue: {
    fontFamily: Fonts.sans,
    fontSize: 12.5,
    fontWeight: "600",
    color: Surface.label,
    flex: 1,
    textAlign: "right",
  },
  viewCourse: {
    alignSelf: "flex-start",
    paddingVertical: Spacing.two,
  },
  viewCourseText: {
    fontFamily: Fonts.monoMedium,
    fontSize: 13,
    fontWeight: "700",
    color: Surface.accent,
  },
});
