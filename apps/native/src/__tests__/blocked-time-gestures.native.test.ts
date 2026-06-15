import {
  BLOCKED_TIME_LONG_PRESS_MS,
  BLOCKED_TIME_MIN_MINUTES,
  BLOCKED_TIME_MOVE_THRESHOLD_PX,
  BLOCKED_TIME_SNAP_MINUTES,
  buildCreateBlockedTimeDraft,
  minutesToCalendarY,
  moveBlockedTimeDraft,
  resizeBlockedTimeDraft,
  shouldCommitBlockedTimeDraft,
  yToCalendarMinutes,
  type CalendarGestureLayout,
} from "@/lib/blocked-time-gestures";

const layout: CalendarGestureLayout = {
  startMinutes: 8 * 60,
  endMinutes: 18 * 60,
  heightPx: 600,
};

describe("blocked-time gesture math", () => {
  it("exports the web-parity gesture constants", () => {
    expect(BLOCKED_TIME_SNAP_MINUTES).toBe(5);
    expect(BLOCKED_TIME_MIN_MINUTES).toBe(30);
    expect(BLOCKED_TIME_MOVE_THRESHOLD_PX).toBe(6);
    expect(BLOCKED_TIME_LONG_PRESS_MS).toBe(350);
  });

  it("converts y positions to snapped minutes and clamps to the visible calendar range", () => {
    expect(yToCalendarMinutes(0, layout)).toBe(8 * 60);
    expect(yToCalendarMinutes(123, layout)).toBe(10 * 60 + 5);
    expect(yToCalendarMinutes(-50, layout)).toBe(8 * 60);
    expect(yToCalendarMinutes(800, layout)).toBe(18 * 60);
  });

  it("converts minutes back to y positions in the same visible range", () => {
    expect(minutesToCalendarY(8 * 60, layout)).toBe(0);
    expect(minutesToCalendarY(13 * 60, layout)).toBe(300);
    expect(minutesToCalendarY(18 * 60, layout)).toBe(600);
  });

  it("builds sorted create drafts and only commits when the minimum duration is met", () => {
    const shortDraft = buildCreateBlockedTimeDraft(
      "Mo",
      9 * 60,
      minutesToCalendarY(9 * 60 + 25, layout),
      layout,
    );
    const longDraft = buildCreateBlockedTimeDraft(
      "Mo",
      9 * 60 + 45,
      minutesToCalendarY(9 * 60, layout),
      layout,
    );

    expect(shortDraft).toEqual({ day: "Mo", startMinutes: 9 * 60, endMinutes: 9 * 60 + 25 });
    expect(shouldCommitBlockedTimeDraft(shortDraft)).toBe(false);
    expect(longDraft).toEqual({ day: "Mo", startMinutes: 9 * 60, endMinutes: 9 * 60 + 45 });
    expect(shouldCommitBlockedTimeDraft(longDraft)).toBe(true);
  });

  it("moves a block by the snapped minute delta while preserving its duration and clamping to the range", () => {
    const block = { day: "Tu" as const, startMinutes: 10 * 60, endMinutes: 11 * 60 + 30 };
    const moved = moveBlockedTimeDraft(
      block,
      10 * 60,
      minutesToCalendarY(12 * 60 + 15, layout),
      layout,
    );
    const clamped = moveBlockedTimeDraft(
      block,
      10 * 60,
      minutesToCalendarY(18 * 60, layout),
      layout,
    );

    expect(moved).toEqual({ day: "Tu", startMinutes: 12 * 60 + 15, endMinutes: 13 * 60 + 45 });
    expect(clamped).toEqual({ day: "Tu", startMinutes: 16 * 60 + 30, endMinutes: 18 * 60 });
  });

  it("resizes the top or bottom edge without crossing the minimum duration", () => {
    const block = { day: "We" as const, startMinutes: 10 * 60, endMinutes: 12 * 60 };

    expect(
      resizeBlockedTimeDraft(block, "top", minutesToCalendarY(11 * 60 + 45, layout), layout),
    ).toEqual({
      day: "We",
      startMinutes: 11 * 60 + 30,
      endMinutes: 12 * 60,
    });
    expect(
      resizeBlockedTimeDraft(block, "bottom", minutesToCalendarY(10 * 60 + 10, layout), layout),
    ).toEqual({
      day: "We",
      startMinutes: 10 * 60,
      endMinutes: 10 * 60 + 30,
    });
  });
});
