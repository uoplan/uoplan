import { createPortal } from "react-dom";
import type { GradeVizData } from "schedule";
import { hexToRgb, ratingToColor } from "schedule";
import type { Phantom, PhantomText } from "../../hooks/useCalendarMorph";
import { GradeDistributionBottomBar } from "./GradeDistributionViz";
import { CalendarEventFace, type CalendarEventFaceProps } from "./CalendarEventFace";

function phantomTextToFaceProps(t: PhantomText): CalendarEventFaceProps {
  const hasNumericRating = t.hasProfessorRating && t.ratingValue != null && t.ratingValue > 0;
  const ratingTier = t.ratingTier || ratingToColor(t.ratingValue ?? null);
  return {
    courseCode: t.courseCode,
    courseTitle: t.courseTitle,
    componentSectionDisplay: t.section,
    timeRange: t.time.trim() ? t.time : null,
    professor: t.professor,
    virtual: t.virtual,
    layout: {
      showSection: !!t.section.trim(),
      showTime: !!t.time.trim(),
      showProfessor: !!t.professor.trim(),
    },
    ratingTier,
    hasProfessorRating: t.hasProfessorRating,
    hasNumericRating,
    professorRatingValue: t.ratingValue,
    legacyId: t.legacyId ?? null,
    professorRatingDetails: undefined,
    interaction: "static",
  };
}

function pickGradeViz(phantom: Phantom): GradeVizData | null {
  const g = phantom.fromText.gradeViz;
  return g && g.total > 0 ? g : null;
}

function PhantomBlock({ phantom }: { phantom: Phantom }) {
  const { colorHex, fromRect, fromText } = phantom;
  const { r, g, b } = hexToRgb(colorHex);
  const bg = `rgba(${r}, ${g}, ${b}, 0.38)`;
  const gradeViz = pickGradeViz(phantom);

  return (
    <div
      className="fc-uoplan-event fc-uoplan-morph-phantom"
      style={{
        position: "fixed",
        pointerEvents: "none",
        top: fromRect.top,
        left: fromRect.left,
        width: fromRect.width,
        height: fromRect.height,
        minHeight: 0,
        borderLeft: `4px solid ${colorHex}`,
        backgroundColor: bg,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <CalendarEventFace {...phantomTextToFaceProps(fromText)} />
      <div className="fc-uoplan-grade-bottom-hitbox">
        <GradeDistributionBottomBar gradeViz={gradeViz} />
      </div>
    </div>
  );
}

interface ScheduleMorphOverlayProps {
  phantoms: Phantom[];
}

export function ScheduleMorphOverlay({ phantoms }: ScheduleMorphOverlayProps) {
  if (phantoms.length === 0) return null;

  return createPortal(
    <>
      {phantoms.map((p) => (
        <PhantomBlock key={p.layoutId} phantom={p} />
      ))}
    </>,
    document.body,
  );
}
