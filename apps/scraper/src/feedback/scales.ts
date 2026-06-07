/**
 * The canonical ordinal response scales used across uOttawa course evaluations,
 * listed best-first (index 0 is the top of the 1-5 scale, the last entry the
 * bottom). Reports expose these labels either in an HTML frequency table (older
 * reports) or baked into a chart image we OCR (modern reports). Because the set is
 * small and standardized, we snap each question's (possibly OCR-noisy) labels to
 * the closest canonical scale, correcting OCR artefacts (merged words, dropped
 * zero-count rows) into clean, complete labels.
 */

// Trailing non-answer options that are not part of the ordinal scale.
const NA_OPTION_LABELS = new Set<string>([
  "question not applicable",
  "no feedback",
  "no classroom meetings were scheduled",
  "no class meetings were scheduled",
]);

const CANONICAL_SCALES: string[][] = [
  ["almost always", "often", "sometimes", "rarely", "almost never"],
  ["strongly agree", "agree", "neither agree nor disagree", "disagree", "strongly disagree"],
  ["strongly agree", "agree", "disagree", "strongly disagree"],
  ["very useful", "useful", "not very useful", "useless"],
  ["excellent", "good", "acceptable", "poor", "very poor"],
  ["enhanced the learning", "had no impact on learning", "detracted from learning"],
];

// Space/punctuation-insensitive key so OCR noise like "almostnever" or "51-75%"
// still matches "almost never" / "51 - 75%".
const looseKey = (label: string): string => label.toLowerCase().replace(/[^a-z0-9]/g, "");

const CANONICAL_LOOKUP = CANONICAL_SCALES.map((scale) => ({
  scale,
  keys: new Set(scale.map(looseKey)),
}));

/**
 * Snap a question's (possibly OCR-noisy) ordinal labels to the closest canonical
 * scale, returning the clean canonical labels when a strong majority match, else
 * the input unchanged. Best-first ordering is preserved.
 */
function snapToCanonicalScale(labels: string[]): string[] {
  const inputKeys = labels.map(looseKey);
  let best: { scale: string[]; score: number; lenDiff: number } | null = null;
  for (const { scale, keys } of CANONICAL_LOOKUP) {
    const score = inputKeys.reduce((n, key) => n + (keys.has(key) ? 1 : 0), 0);
    const lenDiff = Math.abs(scale.length - labels.length);
    if (!best || score > best.score || (score === best.score && lenDiff < best.lenDiff)) {
      best = { scale, score, lenDiff };
    }
  }
  if (best && best.score >= 2 && best.score >= Math.ceil(labels.length * 0.6)) {
    return best.scale;
  }
  return labels;
}

/**
 * The ordinal response labels of a question's option list (best-first, N/A
 * options excluded, snapped to a canonical scale), or `null` when fewer than two
 * ordinal labels remain.
 */
export function ordinalOptionLabels(labels: string[]): string[] | null {
  const ordinal = labels.filter((label) => !NA_OPTION_LABELS.has(label.toLowerCase()));
  if (ordinal.length < 2) return null;
  return snapToCanonicalScale(ordinal.map((label) => label.toLowerCase()));
}
