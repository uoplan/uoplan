import type { MouseEvent } from "react";
import { Box, Tooltip } from "@mantine/core";
import { ProfessorRatingTooltipLabel } from "./ProfessorRatingTooltipLabel";
import { tr } from "../../i18n";

export type CalendarEventFaceLayout = {
  showSection: boolean;
  showTime: boolean;
  showProfessor: boolean;
};

/** Professor rating row detail (matches calendar event / swap modal). */
export type CalendarEventFaceRatingDetail = {
  id?: string;
  legacyId?: number;
  name: string;
  rating: number;
  numRatings: number;
};

export type CalendarEventFaceProps = {
  courseCode: string;
  courseTitle: string;
  /** Shown in the type row; already shortened if desired (e.g. `componentKindOnly`). */
  componentSectionDisplay: string;
  timeRange: string | null;
  professor: string;
  virtual: boolean;
  layout: CalendarEventFaceLayout;
  /** Mantine rating tier key for `fc-uoplan-rating-inline--*`. */
  ratingTier: string;
  hasProfessorRating: boolean;
  hasNumericRating: boolean;
  professorRatingValue: number | null;
  legacyId?: number | null;
  professorRatingDetails: CalendarEventFaceRatingDetail[] | null | undefined;
  /** Interactive: tooltips + RMP links. Static: no tooltips, rating is span only. */
  interaction: "interactive" | "static";
};

export function CalendarEventFace({
  courseCode,
  courseTitle,
  componentSectionDisplay,
  timeRange,
  professor,
  virtual,
  layout,
  ratingTier,
  hasProfessorRating,
  hasNumericRating,
  professorRatingValue,
  legacyId,
  professorRatingDetails,
  interaction,
}: CalendarEventFaceProps) {
  const virtualTail = virtual ? (
    <div className="fc-uoplan-event-row-tail">
      <span className="fc-uoplan-event-virtual">{tr("calendar.event.virtual")}</span>
    </div>
  ) : null;

  const ratingEl =
    hasNumericRating && professorRatingValue != null ? (
      <>
        <span className="fc-uoplan-event-meta-sep" aria-hidden>
          ·
        </span>
        <Box
          component={interaction === "interactive" && legacyId ? "a" : "span"}
          href={
            interaction === "interactive" && legacyId
              ? `https://www.ratemyprofessors.com/professor/${legacyId}`
              : undefined
          }
          target={interaction === "interactive" && legacyId ? "_blank" : undefined}
          rel={interaction === "interactive" && legacyId ? "noopener noreferrer" : undefined}
          onClick={(e: MouseEvent) => e.stopPropagation()}
          className={`fc-uoplan-rating-inline fc-uoplan-rating-inline--${ratingTier}`}
        >
          {professorRatingValue.toFixed(1)}
        </Box>
      </>
    ) : null;

  const professorRowInner = (
    <div className="fc-uoplan-event-professor-row">
      <span className="fc-uoplan-event-professor-name" title={professor}>
        {professor}
      </span>
      {ratingEl}
    </div>
  );

  const professorBlock =
    layout.showProfessor && professor.trim() !== "" ? (
      interaction === "interactive" &&
      hasProfessorRating &&
      professorRatingDetails &&
      professorRatingDetails.length > 0 ? (
        <Tooltip
          label={<ProfessorRatingTooltipLabel details={professorRatingDetails} />}
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
    <div className="fc-uoplan-event-inner">
      <div className="fc-uoplan-event-body">
        <div
          className="fc-uoplan-event-heading"
          title={courseTitle ? `${courseCode} ${courseTitle}` : courseCode}
        >
          <span className="fc-uoplan-event-heading-inline">
            <span className="fc-uoplan-event-code-part">{courseCode}</span>
            {courseTitle ? <span className="fc-uoplan-event-title-part">{courseTitle}</span> : null}
          </span>
        </div>

        <div className="fc-uoplan-event-top-meta">
          {layout.showSection && layout.showTime && timeRange ? (
            <div className="fc-uoplan-event-type-time-row">
              <div className="fc-uoplan-event-type-time-wrap">
                <span className="fc-uoplan-event-type">{componentSectionDisplay}</span>
                <span className="fc-uoplan-event-meta-sep" aria-hidden>
                  ·
                </span>
                <span className="fc-uoplan-event-time">{timeRange}</span>
              </div>
              {virtualTail}
            </div>
          ) : layout.showSection ? (
            <div className="fc-uoplan-event-type-row">
              <span className="fc-uoplan-event-type">{componentSectionDisplay}</span>
              {virtualTail}
            </div>
          ) : layout.showTime && timeRange ? (
            <div className="fc-uoplan-event-time-row">
              <span className="fc-uoplan-event-time">{timeRange}</span>
              {virtualTail}
            </div>
          ) : null}
        </div>

        {professorBlock ? <div className="fc-uoplan-event-professor-bottom">{professorBlock}</div> : null}
      </div>
    </div>
  );
}
