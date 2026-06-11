import { tr } from "../../i18n";
import type { CanonicalProfessorName } from "@uoplan/core";

type CalendarEventFaceLayout = {
  showSection: boolean;
  showTime: boolean;
  showProfessor: boolean;
};

type CalendarEventFaceProps = {
  courseCode: string;
  courseTitle: string;
  /** Shown in the type row; already shortened if desired (e.g. `componentKindOnly`). */
  componentSectionDisplay: string;
  timeRange: string | null;
  professor: CanonicalProfessorName;
  /** When true, the professor is a build-time prediction — render it italic. */
  professorPredicted?: boolean;
  virtual: boolean;
  layout: CalendarEventFaceLayout;
  /**
   * Course-evaluation satisfaction (1-5) for this course — the primary quality
   * signal shown inline. `null` hides the value.
   */
  sentimentValue: number | null;
};

export function CalendarEventFace({
  courseCode,
  courseTitle,
  componentSectionDisplay,
  timeRange,
  professor,
  professorPredicted = false,
  virtual,
  layout,
  sentimentValue,
}: CalendarEventFaceProps) {
  const virtualTail = virtual ? (
    <div className="cal-event-row-tail">
      <span className="cal-event-virtual">{tr("calendar.event.virtual")}</span>
    </div>
  ) : null;

  const sentimentEl =
    sentimentValue != null && sentimentValue > 0 ? (
      <>
        <span className="cal-event-sep" aria-hidden>
          ·
        </span>
        <span className="cal-event-sentiment" title={tr("calendar.event.satisfaction")}>
          {sentimentValue.toFixed(1)}
        </span>
      </>
    ) : null;

  const professorBlock =
    layout.showProfessor && professor.trim() !== "" ? (
      <div className="cal-event-prof-row">
        <span
          className="cal-event-prof-name"
          title={professor}
          style={professorPredicted ? { fontStyle: "italic" } : undefined}
        >
          {professor}
        </span>
        {sentimentEl}
      </div>
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
