/**
 * Single source of truth for professor name identity across the whole site.
 *
 * Professor records arrive from several sources with inconsistent spellings
 * (diacritics, middle names, "Last, First", hyphenated surnames, extra tokens),
 * so a person can split into several entries. The canonical professor registry
 * (built in the scraper, emitted as `professors.pb`) collapses these variants
 * into one entry per person. This module holds the primitives that registry
 * build, runtime lookup, and URL slug generation all share, so every layer
 * computes identity the same way.
 *
 * Identity model:
 *   - {@link professorMatchKey} — the MATCH key used to merge variants into one
 *     person: first token + last token, diacritics stripped, middle names and
 *     punctuation dropped, lowercased. ("Geneviève Tellier", "Genevieve Tellier",
 *     "Alain Saint-Amant", "Alain St-Amant" all collapse together.)
 *   - {@link pickCanonicalProfessorName} — the DISPLAY name for a merged group:
 *     the fullest variant (keeps accents and middle names).
 *   - {@link slugifyProfessor} — the durable, URL-safe public id derived from the
 *     canonical display name (diacritics removed, lowercased, kebab-case).
 */

/** Strip combining diacritical marks (é → e) via NFD decomposition. */
export function deburr(value: string): string {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

/**
 * Lowercased, accent- and punctuation-free word tokens of a name. Punctuation
 * (commas, hyphens, apostrophes, periods) collapses to spaces so "St-Amant",
 * "O'Brien", and "Lee, Julie" tokenize cleanly.
 */
export function professorNameTokens(name: string): string[] {
  return deburr(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
}

/**
 * The match key used to merge name variants into a single professor: the first
 * and last tokens joined by `|`, with middle names and diacritics dropped.
 * Returns "" when no usable token exists (e.g. "Staff"/empty handled by callers)
 * and the single token itself when only one is present.
 */
export function professorMatchKey(name: string): string {
  const tokens = professorNameTokens(name);
  if (tokens.length === 0) return "";
  if (tokens.length === 1) return tokens[0];
  return `${tokens[0]}|${tokens[tokens.length - 1]}`;
}

/**
 * Pick the canonical display name for a group of merged variants: the "fullest"
 * one, preferring more name tokens (keeps middle names), then more accented
 * characters (prefers "Geneviève" over "Genevieve"), then longer, then a stable
 * locale compare for determinism. Surrounding whitespace and any leading/trailing
 * stray periods or commas (e.g. ".Klempan," / "Smith.") are trimmed.
 */
export function pickCanonicalProfessorName(variants: Iterable<string>): string {
  let best: string | null = null;
  let bestScore: [number, number, number] | null = null;

  for (const raw of variants) {
    const name = cleanDisplayName(raw);
    if (!name) continue;
    const tokenCount = professorNameTokens(name).length;
    const accentCount = countAccentedChars(name);
    const score: [number, number, number] = [tokenCount, accentCount, name.length];
    if (best === null || bestScore === null || isBetterScore(score, bestScore, name, best)) {
      best = name;
      bestScore = score;
    }
  }

  return best ?? "";
}

/**
 * Durable, URL-safe public id for a professor, derived from the canonical
 * display name: diacritics removed, lowercased, non-alphanumerics collapsed to
 * single dashes, no leading/trailing dash. ("Geneviève Tellier" → "genevieve-tellier".)
 */
export function slugifyProfessor(name: string): string {
  return deburr(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Trim whitespace and any leading/trailing stray periods or commas from a display name. */
function cleanDisplayName(value: string): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[.,]+|[.,]+$/g, "")
    .trim();
}

function countAccentedChars(value: string): number {
  let count = 0;
  const decomposed = String(value).normalize("NFD");
  for (const ch of decomposed) {
    if (ch >= "\u0300" && ch <= "\u036f") count++;
  }
  return count;
}

function isBetterScore(
  candidate: [number, number, number],
  current: [number, number, number],
  candidateName: string,
  currentName: string,
): boolean {
  for (let i = 0; i < candidate.length; i++) {
    if (candidate[i] !== current[i]) return candidate[i] > current[i];
  }
  // Fully tied scores: stable, locale-aware tiebreak for deterministic builds.
  return candidateName.localeCompare(currentName, "en") < 0;
}
