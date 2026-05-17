import { useState, useEffect, useRef, useCallback } from "react";
import type { GradeVizData } from "schedule";

interface CapturedEvent {
  courseCode: string;
  courseTitle: string;
  colorHex: string;
  rect: DOMRect;
  section: string;
  virtual: boolean;
  time: string;
  professor: string;
  ratingTier: string;
  ratingValue: number | null;
  legacyId?: number;
  hasProfessorRating: boolean;
  gradeViz: GradeVizData | null;
}

export interface PhantomText {
  courseCode: string;
  courseTitle: string;
  section: string;
  virtual: boolean;
  time: string;
  professor: string;
  ratingTier: string;
  ratingValue: number | null;
  legacyId?: number;
  hasProfessorRating: boolean;
  gradeViz: GradeVizData | null;
}

export interface Phantom {
  layoutId: string;
  colorHex: string;
  fromRect: DOMRect;
  fromText: PhantomText;
}

function toPhantomText(event: CapturedEvent): PhantomText {
  return {
    courseCode: event.courseCode,
    courseTitle: event.courseTitle,
    section: event.section,
    virtual: event.virtual,
    time: event.time,
    professor: event.professor,
    ratingTier: event.ratingTier,
    ratingValue: event.ratingValue,
    legacyId: event.legacyId,
    hasProfessorRating: event.hasProfessorRating,
    gradeViz: event.gradeViz,
  };
}

function parseGradeVizDataset(raw: string | undefined): GradeVizData | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as GradeVizData;
    return parsed && typeof parsed.total === "number" && parsed.total > 0 ? parsed : null;
  } catch {
    return null;
  }
}

type Phase =
  | "idle"
  /** Events hidden, phantoms at old positions, FullCalendar rendering new schedule. */
  | "pre-animating"
  /** Phantoms fading out downward; new events fading in upward. */
  | "animating";

/** Duration of the fade + slide animation (ms). */
const TRANSITION_MS = 160;

const RENDER_SETTLE_MS = 50;

function captureEventPositions(container: HTMLElement | null): CapturedEvent[] {
  if (!container) return [];
  const els = container.querySelectorAll<HTMLElement>(".fc-uoplan-event");
  const captures: CapturedEvent[] = [];
  for (const el of els) {
    const courseCode = el.dataset.courseCode ?? "";
    const colorHex = el.dataset.colorHex ?? "";
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      const courseTitle =
        el.dataset.courseTitle?.trim() ??
        el.querySelector(".fc-uoplan-event-title-part")?.textContent?.trim() ??
        "";
      const section = el.querySelector(".fc-uoplan-event-type")?.textContent ?? "";
      const time =
        el.dataset.eventTime ??
        el.querySelector(".fc-uoplan-event-time")?.textContent?.trim() ??
        "";
      const professor =
        el.querySelector(".fc-uoplan-event-professor-name")?.textContent?.trim() ?? "";
      const ratingTier = el.dataset.ratingTier?.trim() ?? "";
      const rv = el.dataset.professorRatingValue;
      const ratingValue =
        rv !== undefined && rv !== "" && Number.isFinite(Number(rv)) ? Number(rv) : null;
      const legacyRaw = el.dataset.rmpLegacyId;
      const legacyId =
        legacyRaw !== undefined && legacyRaw !== "" && Number.isFinite(Number(legacyRaw))
          ? Number(legacyRaw)
          : undefined;
      const hasProfessorRating = ratingTier !== "" || (ratingValue != null && ratingValue > 0);
      const virtual = el.dataset.virtual === "true";
      const gradeViz = parseGradeVizDataset(el.dataset.gradeViz);
      captures.push({
        courseCode,
        courseTitle,
        colorHex,
        rect,
        section,
        virtual,
        time,
        professor,
        ratingTier,
        ratingValue,
        legacyId,
        hasProfessorRating,
        gradeViz,
      });
    }
  }
  return captures;
}

function buildPhantoms(oldEvents: CapturedEvent[]): Phantom[] {
  return oldEvents.map((c, i) => ({
    layoutId: `p${i}`,
    colorHex: c.colorHex,
    fromRect: c.rect,
    fromText: toPhantomText(c),
  }));
}

interface CalendarMorphState {
  phantoms: Phantom[];
  /** Real events must be invisible while phantoms cover the visual. */
  isHidingEvents: boolean;
  /** New events are entering — apply entrance animation. */
  isEntering: boolean;
  /** Synchronously capture old event positions and park phantoms over them.
   *  Call this immediately before triggering a schedule navigation. */
  captureAndPark: () => void;
  /** Call inside a useEffect on the `schedule` prop. Drives the transition
   *  after FullCalendar has settled with the new schedule.
   *  Returns a cleanup function (safe to return directly from useEffect). */
  onScheduleChanged: () => (() => void) | undefined;
}

/**
 * Animation phases:
 *
 *  idle
 *   → pre-animating  phantoms cover old positions; FC renders new schedule (50ms)
 *   → animating      phantoms fade + slide down; new events fade + slide up (250ms)
 *   → idle
 */
export function useCalendarMorph(
  containerRef: React.RefObject<HTMLElement | null>,
  prefersReduced: boolean,
): CalendarMorphState {
  const [phase, setPhase] = useState<Phase>("idle");
  const [phantoms, setPhantoms] = useState<Phantom[]>([]);

  const phaseRef = useRef<Phase>("idle");

  const setPhaseAndRef = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const captureAndPark = useCallback(() => {
    if (phaseRef.current !== "idle") return;
    if (prefersReduced) return;

    const oldCaptures = captureEventPositions(containerRef.current);
    setPhantoms(buildPhantoms(oldCaptures));
    setPhaseAndRef("pre-animating");
  }, [prefersReduced, containerRef, setPhaseAndRef]);

  const onScheduleChanged = useCallback((): (() => void) | undefined => {
    if (phaseRef.current !== "pre-animating") return;

    let cleanup: ReturnType<typeof setTimeout>;

    const settled = window.setTimeout(() => {
      setPhaseAndRef("animating");

      cleanup = window.setTimeout(() => {
        setPhantoms([]);
        setPhaseAndRef("idle");
      }, TRANSITION_MS + 50);
    }, RENDER_SETTLE_MS);

    return () => {
      window.clearTimeout(settled);
      window.clearTimeout(cleanup);
    };
  }, [setPhaseAndRef]);

  // Safety valve: if we somehow get stuck in pre-animating, reset.
  useEffect(() => {
    if (phase !== "pre-animating") return;
    const t = window.setTimeout(() => {
      setPhantoms([]);
      setPhaseAndRef("idle");
    }, 2000);
    return () => window.clearTimeout(t);
  }, [phase, setPhaseAndRef]);

  return {
    phantoms,
    isHidingEvents: phase === "pre-animating",
    isEntering: phase === "animating",
    captureAndPark,
    onScheduleChanged,
  };
}
