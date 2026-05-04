import { useRef, useEffect, useCallback, useLayoutEffect } from "react";
import { createPortal } from "react-dom";
import type { GradeVizData } from "schedule";
import { hexToRgb, ratingToColor } from "schedule";
import type { Phantom, PhantomText } from "../../hooks/useCalendarMorph";
import { HALF_PHANTOM_MS, PHANTOM_MS } from "../../hooks/useCalendarMorph";
import { GradeDistributionBottomBar } from "./GradeDistributionViz";
import { CalendarEventFace, type CalendarEventFaceProps } from "./CalendarEventFace";

const MORPH_EASE = "cubic-bezier(0.4, 0, 0.2, 1)";

function phantomTextToFaceProps(t: PhantomText): CalendarEventFaceProps {
  const hasNumericRating =
    t.hasProfessorRating && t.ratingValue != null && t.ratingValue > 0;
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
  if (phantom.kind === "flip") {
    const next = phantom.toText.gradeViz;
    if (next && next.total > 0) return next;
    const prev = phantom.fromText.gradeViz;
    return prev && prev.total > 0 ? prev : null;
  }
  const g = phantom.fromText.gradeViz;
  return g && g.total > 0 ? g : null;
}

function PhantomBlock({
  phantom,
  onComplete,
}: {
  phantom: Phantom;
  onComplete: () => void;
}) {
  const shellRef = useRef<HTMLDivElement>(null);
  const { colorHex, kind, fromRect } = phantom;
  const { r, g, b } = hexToRgb(colorHex);
  const bg = `rgba(${r}, ${g}, ${b}, 0.38)`;

  const isFlip = kind === "flip";
  const fromText = phantom.fromText;
  const toText = isFlip ? phantom.toText : fromText;
  /** Start at the old rect so we can animate geometry without transform scale (which blows up type). */
  const geoRect = fromRect;
  const gradeViz = pickGradeViz(phantom);

  useLayoutEffect(() => {
    const el = shellRef.current;
    if (!el) return;

    let finished = false;
    const safeComplete = () => {
      if (finished) return;
      finished = true;
      onComplete();
    };

    el.style.setProperty("--uoplan-morph-half-ms", `${HALF_PHANTOM_MS}ms`);
    el.style.setProperty("--uoplan-morph-full-ms", `${PHANTOM_MS}ms`);

    if (phantom.kind !== "flip") {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.classList.add("fc-uoplan-morph-phantom--animating-fade");
        });
      });
      const onEnd = (e: TransitionEvent) => {
        if (e.target === el && e.propertyName === "opacity") {
          el.removeEventListener("transitionend", onEnd);
          safeComplete();
        }
      };
      el.addEventListener("transitionend", onEnd);
      const t = window.setTimeout(() => safeComplete(), PHANTOM_MS + 80);
      return () => {
        el.removeEventListener("transitionend", onEnd);
        window.clearTimeout(t);
      };
    }

    const to = phantom.toRect;
    const from = fromRect;
    const needsGeo =
      Math.abs(to.top - from.top) > 0.5 ||
      Math.abs(to.left - from.left) > 0.5 ||
      Math.abs(to.width - from.width) > 0.5 ||
      Math.abs(to.height - from.height) > 0.5;

    const dur = `${HALF_PHANTOM_MS}ms`;
    const geom = `top ${dur} ${MORPH_EASE}, left ${dur} ${MORPH_EASE}, width ${dur} ${MORPH_EASE}, height ${dur} ${MORPH_EASE}`;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        el.classList.add("fc-uoplan-morph-phantom--animating-layers");
        if (needsGeo) {
          el.style.transition = geom;
          el.style.top = `${to.top}px`;
          el.style.left = `${to.left}px`;
          el.style.width = `${to.width}px`;
          el.style.height = `${to.height}px`;
        }
      });
    });

    const t = window.setTimeout(() => safeComplete(), HALF_PHANTOM_MS + 80);
    return () => {
      window.clearTimeout(t);
      el.style.transition = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one run per phantom.layoutId; rects are fixed for that id
  }, [phantom.layoutId, onComplete]);

  return (
    <div
      ref={shellRef}
      className={`fc-uoplan-event fc-uoplan-morph-phantom${isFlip ? "" : " fc-uoplan-morph-phantom--fade-out"}`}
      style={{
        position: "fixed",
        pointerEvents: "none",
        top: geoRect.top,
        left: geoRect.left,
        width: geoRect.width,
        height: geoRect.height,
        minHeight: 0,
        borderLeft: `4px solid ${colorHex}`,
        backgroundColor: bg,
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div className="fc-uoplan-morph-phantom-surface">
        {isFlip ? (
          <>
            <div className="fc-uoplan-morph-phantom-layer fc-uoplan-morph-phantom-layer--out">
              <CalendarEventFace {...phantomTextToFaceProps(fromText)} />
            </div>
            <div className="fc-uoplan-morph-phantom-layer fc-uoplan-morph-phantom-layer--in">
              <CalendarEventFace {...phantomTextToFaceProps(toText)} />
            </div>
          </>
        ) : (
          <div className="fc-uoplan-morph-phantom-layer">
            <CalendarEventFace {...phantomTextToFaceProps(fromText)} />
          </div>
        )}
      </div>
      <div className="fc-uoplan-grade-bottom-hitbox">
        <GradeDistributionBottomBar gradeViz={gradeViz} fallbackColor={colorHex} />
      </div>
    </div>
  );
}

interface ScheduleMorphOverlayProps {
  phantoms: Phantom[];
  onComplete: () => void;
}

export function ScheduleMorphOverlay({
  phantoms,
  onComplete,
}: ScheduleMorphOverlayProps) {
  const remainingRef = useRef(0);

  const handleOne = useCallback(() => {
    remainingRef.current -= 1;
    if (remainingRef.current <= 0) {
      onComplete();
    }
  }, [onComplete]);

  useEffect(() => {
    remainingRef.current = phantoms.length;
  }, [phantoms]);

  if (phantoms.length === 0) return null;

  return createPortal(
    <>
      {phantoms.map((p) => (
        <PhantomBlock key={p.layoutId} phantom={p} onComplete={handleOne} />
      ))}
    </>,
    document.body,
  );
}
