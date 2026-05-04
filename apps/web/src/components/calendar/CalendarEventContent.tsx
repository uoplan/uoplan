import { useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { Box, Tooltip } from "@mantine/core";
import type { DataCache } from "schedule";
import { COURSE_COLORS, COURSE_COLOR_HEX, hexToRgb, ratingColorToCssVar, ratingToColor } from "schedule";
import type { CalendarEvent } from "../../hooks/useCalendarEvents";
import { tr } from "../../i18n";
import { ProfessorRatingTooltipLabel } from "./ProfessorRatingTooltipLabel";
import { GradeDistributionBottomBar } from "./GradeDistributionViz";
import { componentKindOnly, formatTimeRange } from "./calendarEventDisplayUtils";

/** Matches `.fc-uoplan-event-inner` vertical padding (8px + 8px). */
const INNER_PAD_Y = 16;
/** Matches `.fc-uoplan-event-inner` horizontal padding (8px + 8px). */
const INNER_PAD_X = 16;
/** Matches `.fc-uoplan-grade-bottom` height. */
const GRADE_BAR_H = 4;

function deriveLayout(innerWidth: number, innerHeight: number) {
  const tight = innerHeight < 50;
  return {
    tight,
    showSection: innerHeight >= 34 && innerWidth >= 42,
    showTime: innerHeight >= 44 && innerWidth >= 42,
    /** One line with name + optional rating; keep in sync with ~showTime so they don’t disappear first. */
    showProfessor: innerHeight >= 44 && innerWidth >= 42,
  };
}

export function CalendarEventContent({
  ext,
  cache,
  colorMap,
}: {
  ext: CalendarEvent;
  cache: DataCache | null;
  colorMap: Record<string, number>;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const cr = entries[0]?.contentRect;
      if (!cr) return;
      setSize({ width: cr.width, height: cr.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const courseTitle = useMemo(
    () => cache?.getCourse(ext.courseCode)?.title ?? "",
    [cache, ext.courseCode],
  );

  const colorIdx = colorMap[ext.courseCode] ?? ext.enrollmentIndex;
  const colorName = COURSE_COLORS[colorIdx % COURSE_COLORS.length];
  const hex = COURSE_COLOR_HEX[colorName];
  const { r, g, b } = useMemo(() => hexToRgb(hex), [hex]);

  const legacyId = useMemo(
    () => ext.professorRatingDetails?.find((d) => d.legacyId)?.legacyId,
    [ext.professorRatingDetails],
  );
  const ratingColor = useMemo(
    () => ratingToColor(ext.professorRatingValue ?? null),
    [ext.professorRatingValue],
  );
  const markerColor = useMemo(() => ratingColorToCssVar(ratingColor), [ratingColor]);
  const hasProfessorRating = !!(ext.professorRatingDetails && ext.professorRatingDetails.length > 0);
  const hasNumericRating =
    hasProfessorRating &&
    ext.professorRatingValue != null &&
    ext.professorRatingValue > 0 &&
    !!ext.professorRatingDetails;

  const innerWidth = Math.max(0, size.width - INNER_PAD_X);
  const innerHeight = Math.max(0, size.height - INNER_PAD_Y - GRADE_BAR_H);
  const layout = deriveLayout(innerWidth, innerHeight);

  const timeRange = useMemo(
    () => formatTimeRange(ext.startMinutes, ext.endMinutes),
    [ext.startMinutes, ext.endMinutes],
  );
  const aPlusPercent = useMemo(() => {
    const gradeViz = ext.gradeViz;
    if (!gradeViz || gradeViz.total <= 0) return 0;
    const aPlusCount = gradeViz.histogram.find((entry) => entry.grade === "A+")?.count ?? 0;
    return Math.round((aPlusCount / gradeViz.total) * 100);
  }, [ext.gradeViz]);

  const gradeTooltip =
    ext.gradeViz && ext.gradeViz.total > 0 ? (
      tr("calendar.grade.compactTooltip", {
        passing: Math.round(ext.gradeViz.passingPercent),
        aPlus: aPlusPercent,
      })
    ) : null;

  const gradeBottom = <GradeDistributionBottomBar gradeViz={ext.gradeViz} fallbackColor={hex} />;

  const virtualTail = ext.virtual ? (
    <div className="fc-uoplan-event-row-tail">
      <span className="fc-uoplan-event-virtual">{tr("calendar.event.virtual")}</span>
    </div>
  ) : null;

  const professorRowInner = (
    <div className="fc-uoplan-event-professor-row">
      <span className="fc-uoplan-event-professor-name" title={ext.professor}>
        {ext.professor}
      </span>
      {hasNumericRating && ext.professorRatingDetails ? (
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
            className={`fc-uoplan-rating-inline fc-uoplan-rating-inline--${ratingColor}`}
          >
            {ext.professorRatingValue!.toFixed(1)}
          </Box>
        </>
      ) : null}
    </div>
  );

  const professorBlock =
    layout.showProfessor && ext.professor.trim() !== "" ? (
      hasProfessorRating && ext.professorRatingDetails ? (
        <Tooltip
          label={<ProfessorRatingTooltipLabel details={ext.professorRatingDetails} />}
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
      ref={rootRef}
      className={`fc-uoplan-event${layout.tight ? " fc-uoplan-event--tight" : ""}`}
      data-course-code={ext.courseCode}
      data-color-hex={hex}
      data-event-time={timeRange}
      data-virtual={ext.virtual ? "true" : undefined}
      data-rating-color={hasProfessorRating ? markerColor : ""}
      style={{
        cursor: "pointer",
        borderLeft: `4px solid ${hex}`,
        backgroundColor: `rgba(${r}, ${g}, ${b}, 0.38)`,
      }}
    >
      <div className="fc-uoplan-event-inner">
        <div className="fc-uoplan-event-body">
          <div
            className="fc-uoplan-event-heading"
            title={courseTitle ? `${ext.courseCode} ${courseTitle}` : ext.courseCode}
          >
            <span className="fc-uoplan-event-heading-inline">
              <span className="fc-uoplan-event-code-part">{ext.courseCode}</span>
              {courseTitle ? <span className="fc-uoplan-event-title-part">{courseTitle}</span> : null}
            </span>
          </div>

          <div className="fc-uoplan-event-top-meta">
            {layout.showSection && layout.showTime ? (
              <div className="fc-uoplan-event-type-time-row">
                <div className="fc-uoplan-event-type-time-wrap">
                  <span className="fc-uoplan-event-type">{componentKindOnly(ext.componentSection)}</span>
                  <span className="fc-uoplan-event-meta-sep" aria-hidden>
                    ·
                  </span>
                  <span className="fc-uoplan-event-time">{timeRange}</span>
                </div>
                {virtualTail}
              </div>
            ) : layout.showSection ? (
              <div className="fc-uoplan-event-type-row">
                <span className="fc-uoplan-event-type">{componentKindOnly(ext.componentSection)}</span>
                {virtualTail}
              </div>
            ) : layout.showTime ? (
              <div className="fc-uoplan-event-time-row">
                <span className="fc-uoplan-event-time">{timeRange}</span>
                {virtualTail}
              </div>
            ) : null}
          </div>

          {professorBlock ? <div className="fc-uoplan-event-professor-bottom">{professorBlock}</div> : null}
        </div>
      </div>
      {gradeTooltip ? (
        <Tooltip label={gradeTooltip} withArrow position="top" withinPortal color="dark">
          <div className="fc-uoplan-grade-bottom-hitbox">{gradeBottom}</div>
        </Tooltip>
      ) : (
        <div className="fc-uoplan-grade-bottom-hitbox">{gradeBottom}</div>
      )}
    </div>
  );
}
