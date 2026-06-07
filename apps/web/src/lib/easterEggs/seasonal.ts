/**
 * Deterministic, date-aware footer flourish. A pure resolver so it is trivially
 * unit-testable and SSR-safe: given a date it returns a single emoji plus a
 * translated message id, or `null` on an ordinary day. The footer renders this
 * as a tiny, easy-to-miss touch next to the build string.
 *
 * Ordering matters — the first matching rule wins, so specific single days
 * (e.g. Apr 1, Jul 1, Oct 31) are checked before whole-month fallbacks.
 */

interface SeasonalFlourish {
  emoji: string;
  /** tr() id for the short phrase shown after the emoji. */
  msgId: string;
}

interface SeasonalRule {
  /** Inclusive match on (month, day); day omitted matches the whole month. */
  match: (month: number, day: number) => boolean;
  emoji: string;
  msgId: string;
}

/** Month indices are 1-based here for readability. */
const RULES: readonly SeasonalRule[] = [
  // New Year's Day.
  { match: (m, d) => m === 1 && d === 1, emoji: "🎉", msgId: "easterEgg.seasonal.newYear" },
  // April Fools' — a knowing wink.
  { match: (m, d) => m === 4 && d === 1, emoji: "😉", msgId: "easterEgg.seasonal.aprilFools" },
  // Canada Day.
  { match: (m, d) => m === 7 && d === 1, emoji: "🍁", msgId: "easterEgg.seasonal.canadaDay" },
  // Halloween.
  { match: (m, d) => m === 10 && d === 31, emoji: "🎃", msgId: "easterEgg.seasonal.halloween" },
  // Exam crunch — first half of December.
  { match: (m, d) => m === 12 && d <= 23, emoji: "📚", msgId: "easterEgg.seasonal.examSeason" },
  // Holidays — late December.
  { match: (m, d) => m === 12 && d >= 24, emoji: "🎄", msgId: "easterEgg.seasonal.holidays" },
  // Deep Ottawa winter.
  { match: (m) => m === 1 || m === 2, emoji: "❄️", msgId: "easterEgg.seasonal.winter" },
];

/** Resolve the flourish for a given date, or `null` for an ordinary day. */
export function seasonalFlourish(date: Date = new Date()): SeasonalFlourish | null {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const rule = RULES.find((r) => r.match(month, day));
  return rule ? { emoji: rule.emoji, msgId: rule.msgId } : null;
}
