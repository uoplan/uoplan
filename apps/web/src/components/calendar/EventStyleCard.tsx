import type { ComponentSection, CourseEnrollment, DataCache } from "schedule";
import {
  COURSE_COLORS,
  COURSE_COLOR_HEX,
  getRatingDetailsForInstructors,
  getRatingsForInstructors,
  hexToRgb,
  type ProfessorRatingsMap,
  ratingColorToCssVar,
  ratingToColor,
} from "schedule";
import { CalendarEventFace } from "./CalendarEventFace";
import { componentKindOnly, formatTimeRange } from "./calendarEventDisplayUtils";

interface EventStyleCardProps {
  enrollment: CourseEnrollment;
  enrollmentIndex: number;
  cache: DataCache | null;
  professorRatings: ProfessorRatingsMap | null;
  /** When set (e.g. from clicked calendar block), matches component/section and virtual label. */
  componentSection?: string;
  virtual?: boolean;
}

function pickSectionEntry(
  enrollment: CourseEnrollment,
  componentSectionFromClick: string | undefined,
): [string, { section: ComponentSection }] | undefined {
  const entries = Object.entries(enrollment.sectionCombo);
  if (entries.length === 0) return undefined;
  if (!componentSectionFromClick) return entries[0];
  const sep = " - ";
  const i = componentSectionFromClick.indexOf(sep);
  const comp = i >= 0 ? componentSectionFromClick.slice(0, i) : null;
  if (comp && enrollment.sectionCombo[comp]) {
    return [comp, enrollment.sectionCombo[comp]];
  }
  return entries[0];
}

export function EventStyleCard({
  enrollment,
  enrollmentIndex,
  cache,
  professorRatings,
  componentSection: componentSectionProp,
  virtual,
}: EventStyleCardProps) {
  const courseTitle = cache?.getCourse(enrollment.courseCode)?.title ?? "";

  const picked = pickSectionEntry(enrollment, componentSectionProp);
  const componentSectionFull = picked
    ? `${picked[0]} - ${picked[1].section.sectionCode ?? picked[1].section.section ?? ""}`
    : "—";
  const professor = picked
    ? [...new Set(picked[1].section.instructors ?? [])].filter(Boolean).join(", ") || "—"
    : "—";

  const firstTime = picked?.[1].section.times?.[0];
  const timeRange =
    firstTime && firstTime.startMinutes < firstTime.endMinutes
      ? formatTimeRange(firstTime.startMinutes, firstTime.endMinutes)
      : null;

  const ratings = picked
    ? getRatingsForInstructors(picked[1].section.instructors ?? [], professorRatings)
    : [];
  const ratingValue =
    ratings.length > 0
      ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
      : null;
  const ratingDetails = picked
    ? getRatingDetailsForInstructors(picked[1].section.instructors ?? [], professorRatings)
    : [];

  const legacyId = ratingDetails.find((d) => d.legacyId)?.legacyId;
  const hasProfessorRating = ratingDetails.length > 0;
  const hasNumericRating = hasProfessorRating && ratingValue != null && ratingValue > 0;

  const colorName = COURSE_COLORS[enrollmentIndex % COURSE_COLORS.length];
  const hex = COURSE_COLOR_HEX[colorName];
  const { r, g, b } = hexToRgb(hex);
  const ratingTier = ratingToColor(ratingValue ?? null);
  const markerColor = ratingColorToCssVar(ratingTier);

  return (
    <div
      className="fc-uoplan-event fc-uoplan-event--swap-card"
      data-color-hex={hex}
      data-rating-color={hasProfessorRating ? markerColor : ""}
      style={{
        borderLeft: `4px solid ${hex}`,
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.38)`,
      }}
    >
      <CalendarEventFace
        courseCode={enrollment.courseCode}
        courseTitle={courseTitle}
        componentSectionDisplay={componentKindOnly(componentSectionFull)}
        timeRange={timeRange}
        professor={professor}
        virtual={!!virtual}
        layout={{
          showSection: true,
          showTime: !!timeRange,
          showProfessor: true,
        }}
        ratingTier={ratingTier}
        hasProfessorRating={hasProfessorRating}
        hasNumericRating={hasNumericRating}
        professorRatingValue={ratingValue}
        legacyId={legacyId ?? null}
        professorRatingDetails={ratingDetails}
        interaction="interactive"
      />
    </div>
  );
}
