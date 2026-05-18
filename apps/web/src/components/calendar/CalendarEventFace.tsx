import type { MouseEvent } from "react";
import { Box, Tooltip } from "@mantine/core";
import { ProfessorRatingTooltipLabel } from "./ProfessorRatingTooltipLabel";
import { tr } from "../../i18n";

type CalendarEventFaceLayout = {
  showSection: boolean;
  showTime: boolean;
  showProfessor: boolean;
};

/** Professor rating row detail (matches calendar event / swap modal). */
type CalendarEventFaceRatingDetail = {
  id?: string;
  legacyId?: number;
  name: string;
  rating: number;
  numRatings: number;
};

type CalendarEventFaceProps = {
  courseCode: string;
  courseTitle: string;
  /** Shown in the type row; already shortened if desired (e.g. `componentKindOnly`). */
  componentSectionDisplay: string;
  timeRange: string | null;
  professor: string;
  virtual: boolean;
  layout: CalendarEventFaceLayout;
  /** Mantine rating tier key for `cal-rating--*`. */
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
    <div className="cal-event-row-tail">
      <span className="cal-event-virtual">{tr("calendar.event.virtual")}</span>
    </div>
  ) : null;

  const ratingEl =
    hasNumericRating && professorRatingValue != null ? (
      <>
        <span className="cal-event-sep" aria-hidden>
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
          className={`cal-rating cal-rating--${ratingTier}`}
        >
          {professorRatingValue.toFixed(1)}
        </Box>
      </>
    ) : null;

  const professorRowInner = (
    <div className="cal-event-prof-row">
      <span className="cal-event-prof-name" title={professor}>
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
    <div className="cal-event-inner">
      <div className="cal-event-body">
        <div
          className="cal-event-heading"
          title={courseTitle ? `${courseCode} ${courseTitle}` : courseCode}
        >
          <span className="cal-event-heading-inline">
            <span className="cal-event-code">{courseCode}</span>
            {courseTitle ? <span className="cal-event-title">{courseTitle}</span> : null}
          </span>
        </div>

        <div className="cal-event-meta">
          {layout.showSection && layout.showTime && timeRange ? (
            <div className="cal-event-type-time-row">
              <div className="cal-event-type-time-wrap">
                <span className="cal-event-type">{componentSectionDisplay}</span>
                <span className="cal-event-sep" aria-hidden>
                  ·
                </span>
                <span className="cal-event-time">{timeRange}</span>
              </div>
              {virtualTail}
            </div>
          ) : layout.showSection ? (
            <div className="cal-event-type-row">
              <span className="cal-event-type">{componentSectionDisplay}</span>
              {virtualTail}
            </div>
          ) : layout.showTime && timeRange ? (
            <div className="cal-event-time-row">
              <span className="cal-event-time">{timeRange}</span>
              {virtualTail}
            </div>
          ) : null}
        </div>

        {professorBlock ? <div className="cal-event-prof-bottom">{professorBlock}</div> : null}
      </div>
    </div>
  );
}
