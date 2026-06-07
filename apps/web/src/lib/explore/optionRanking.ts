import type { ComboboxItem, OptionsFilter } from "@mantine/core";

/** Searchable fields for a single option: its short `code` and a longer `text` (name/title). */
export type RankableOption = { code: string; text: string };

/**
 * Match tiers (lower = more relevant), mirroring the professor-search ranking but
 * code-first so an exact/prefix code match always wins:
 *   0 exact code match
 *   1 code starts with the query
 *   2 a word in the text starts with the query
 *   3 substring match anywhere in code or text
 * Returns `null` when the option does not match at all.
 *
 * Multi-word queries require every word to match somewhere (AND); the option is
 * scored by the strongest (lowest) tier any single word achieves.
 */
export function rankOptionMatch(rawQuery: string, option: RankableOption): number | null {
  const code = option.code.toLowerCase();
  const text = option.text.toLowerCase();
  const haystack = `${code} ${text}`;
  const textWords = text.split(/\s+/).filter(Boolean);

  const words = rawQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0;

  let best = Number.POSITIVE_INFINITY;
  for (const word of words) {
    if (!haystack.includes(word)) return null;
    let tier = 3;
    if (code === word) tier = 0;
    else if (code.startsWith(word)) tier = 1;
    else if (textWords.some((w) => w.startsWith(word))) tier = 2;
    if (tier < best) best = tier;
  }
  return best;
}

/**
 * Build a Mantine `OptionsFilter` that keeps only matching options and orders them
 * by relevance (see {@link rankOptionMatch}), breaking ties alphabetically by code.
 * `getText` maps an option to its searchable `{ code, text }`.
 */
export function createRankedOptionsFilter(
  getText: (option: ComboboxItem) => RankableOption,
): OptionsFilter {
  return ({ options, search }) => {
    const query = search.trim();
    const items = options as ComboboxItem[];
    if (query.length === 0) return items;

    const scored: { option: ComboboxItem; rank: number; code: string }[] = [];
    for (const option of items) {
      const fields = getText(option);
      const rank = rankOptionMatch(query, fields);
      if (rank === null) continue;
      scored.push({ option, rank, code: fields.code });
    }

    scored.sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      return a.code.localeCompare(b.code, "en");
    });

    return scored.map((s) => s.option);
  };
}
