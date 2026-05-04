import type { MouseEvent } from "react";
import { Box, Tooltip } from "@mantine/core";
import type { DataCache } from "schedule";
import type { CourseEnrollment } from "schedule";
import type { ComponentSection } from "schedule";
import {
  getRatingsForInstructors,
  getRatingDetailsForInstructors,
  type ProfessorRatingsMap,
} from "schedule";
import {
  COURSE_COLORS,
  COURSE_COLOR_HEX,
  hexToRgb,
  ratingToColor,
  ratingColorToCssVar,
} from "schedule";
import { ProfessorRatingTooltipLabel } from "./ProfessorRatingTooltipLabel";
import { tr } from "../../i18n";
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
  const hasNumericRating =
    hasProfessorRating && ratingValue != null && ratingValue > 0;

  const colorName = COURSE_COLORS[enrollmentIndex % COURSE_COLORS.length];
  const hex = COURSE_COLOR_HEX[colorName];
  const { r, g, b } = hexToRgb(hex);
  const ratingTier = ratingToColor(ratingValue ?? null);
  const markerColor = ratingColorToCssVar(ratingTier);

  const virtualTail = virtual ? (
    <div className="fc-uoplan-event-row-tail">
      <span className="fc-uoplan-event-virtual">{tr("calendar.event.virtual")}</span>
    </div>
  ) : null;

  const professorRowInner = (
    <div className="fc-uoplan-event-professor-row">
      <span className="fc-uoplan-event-professor-name" title={professor}>
        {professor}
      </span>
      {hasNumericRating ? (
        <>
          <span className="fc-uoplan-event-meta-sep" aria-hidden>
            ·
          </span>
          <Box
            component={legacyId ? "a" : "span"}
            href={legacyId ? `https://www.ratemyprofessors.com/professor/${legacyId}` : undefined}
            target={legacyId ? "_blank" : undefined}
            rel={legacyId ? "noopener noreferrer" : undefined}
            onClick={(e: MouseEvent) => e.stopPropagation()}
            className={`fc-uoplan-rating-inline fc-uoplan-rating-inline--${ratingTier}`}
          >
            {ratingValue.toFixed(1)}
          </Box>
        </>
      ) : null}
    </div>
  );

  const professorBlock =
    professor.trim() !== "" ? (
      hasProfessorRating ? (
        <Tooltip
          label={<ProfessorRatingTooltipLabel details={ratingDetails} />}
          withArrow
          position="top"
          withinPortal
          color="dark"
        >
          {professorRowInner}
        </Tooltip>
      ) : (
        professorRowInner
      )
    ) : null;

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
      <div className="fc-uoplan-event-inner">
        <div className="fc-uoplan-event-body">
          <div
            className="fc-uoplan-event-heading"
            title={courseTitle ? `${enrollment.courseCode} ${courseTitle}` : enrollment.courseCode}
          >
            <span className="fc-uoplan-event-heading-inline">
              <span className="fc-uoplan-event-code-part">{enrollment.courseCode}</span>
              {courseTitle ? <span className="fc-uoplan-event-title-part">{courseTitle}</span> : null}
            </span>
          </div>

          <div className="fc-uoplan-event-top-meta">
            {timeRange ? (
              <div className="fc-uoplan-event-type-time-row">
                <div className="fc-uoplan-event-type-time-wrap">
                  <span className="fc-uoplan-event-type">{componentKindOnly(componentSectionFull)}</span>
                  <span className="fc-uoplan-event-meta-sep" aria-hidden>
                    ·
                  </span>
                  <span className="fc-uoplan-event-time">{timeRange}</span>
                </div>
                {virtualTail}
              </div>
            ) : (
              <div className="fc-uoplan-event-type-row">
                <span className="fc-uoplan-event-type">{componentKindOnly(componentSectionFull)}</span>
                {virtualTail}
              </div>
            )}
          </div>

          {professorBlock ? (
            <div className="fc-uoplan-event-professor-bottom">{professorBlock}</div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
