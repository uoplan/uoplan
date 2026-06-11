function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d = Array.from({ length: m + 1 }, (): number[] => Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let j = 1; j <= n; j++) {
    for (let i = 1; i <= m; i++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
    }
  }
  return d[m][n];
}

function normalizedSimilarity(a: string, b: string): number {
  if (a.length === 0 && b.length === 0) return 1;
  const maxLen = Math.max(a.length, b.length, 1);
  return 1 - levenshtein(a, b) / maxLen;
}

const SEMESTER_HEADER = /\b\d{4}\s+(?:Fall|Winter|Spring|Summer)(?:\s*\/\s*Summer)?\s*Term\b/im;

function getLastSemesterSegment(transcriptText: string): string {
  const lines = transcriptText.split(/\r?\n/);
  let lastHeaderIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (SEMESTER_HEADER.test(lines[i])) {
      lastHeaderIndex = i;
    }
  }
  return lines.slice(lastHeaderIndex).join("\n");
}

function extractProgramBetweenTermAndCourse(text: string): {
  main: string | null;
  minor: string | null;
} {
  const normalized = text.replaceAll(/\s+/g, " ").trim();
  const match = normalized.match(/Term\s+(.+?)\s+(Course|Transfer)\b/i);
  if (!match) return { main: null, minor: null };
  const fullFragment = match[1].replaceAll(/\s+/g, " ").trim();

  let mainPart = fullFragment;
  let minorPart: string | null = null;

  const withIndex = fullFragment.toLowerCase().indexOf(" with ");
  if (withIndex !== -1) {
    mainPart = fullFragment.slice(0, withIndex).trim();
    minorPart = fullFragment.slice(withIndex + 6).trim();
  }

  const formatMain = (fragment: string) => {
    const result = fragment
      .replaceAll(
        /\b(Honours)\s+(?:Bachelor(?:'s)?|Bachelors)\s+of\s+([A-Za-z]{2})[A-Za-z]*\b/gi,
        (_match, honours: string, two: string) =>
          `${honours} B${two[0]?.toUpperCase() ?? ""}${two[1]?.toLowerCase() ?? ""}`,
      )
      .replaceAll(/\bin\b/gi, " ")
      .replaceAll(/\s+/g, " ")
      .trim();
    return result.length >= 5 ? result : null;
  };

  return {
    main: formatMain(mainPart),
    minor: minorPart && minorPart.length >= 5 ? minorPart : null,
  };
}

function buildMultilineCandidates(text: string): string[] {
  const lines = text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const candidates: string[] = [];
  const maxWindow = 4;
  for (let windowSize = 1; windowSize <= maxWindow; windowSize++) {
    for (let i = 0; i <= lines.length - windowSize; i++) {
      const chunk = lines
        .slice(i, i + windowSize)
        .join(" ")
        .replaceAll(/\s+/g, " ")
        .trim();
      if (chunk.length >= 5 && chunk.length <= 250) {
        candidates.push(chunk);
      }
    }
  }
  return [...new Set(candidates)];
}

function findClosestTitle<T extends { title: string }>(
  fragment: string,
  items: T[],
  minScore: number,
): T | null {
  const fragmentLower = fragment.toLowerCase().replaceAll(/\s+/g, " ").trim();
  let best: T | null = null;
  let bestScore = 0;

  for (const item of items) {
    const title = item.title.trim();
    if (!title) continue;
    const titleLower = title.toLowerCase().replaceAll(/\s+/g, " ").trim();
    const score = normalizedSimilarity(titleLower, fragmentLower);

    if (score > bestScore) {
      bestScore = score;
      best = item;
    }
  }

  return bestScore >= minScore ? best : null;
}

function findProgramByMultilineFallback<T extends { title: string }>(
  searchText: string,
  programs: T[],
): T | null {
  let mainSearchText = searchText;
  const withIndex = searchText.toLowerCase().indexOf(" with ");
  if (withIndex !== -1) {
    mainSearchText = searchText.slice(0, withIndex);
  }

  const candidates = buildMultilineCandidates(mainSearchText);
  let bestProgram: T | null = null;
  let bestScore = 0;

  for (const program of programs) {
    const title = program.title.trim();
    if (!title) continue;

    let score = 0;
    const titleLower = title.toLowerCase();

    for (const chunk of candidates) {
      const similarity = normalizedSimilarity(titleLower, chunk.toLowerCase());
      if (similarity > score) score = similarity;
    }

    if (score < 0.5) {
      const windowLen = Math.min(title.length + 30, mainSearchText.length);
      for (let i = 0; i <= mainSearchText.length - windowLen; i += 3) {
        const chunk = mainSearchText
          .slice(i, i + windowLen)
          .replaceAll(/\s+/g, " ")
          .trim();
        if (chunk.length >= 5) {
          const similarity = normalizedSimilarity(titleLower, chunk.toLowerCase());
          if (similarity > score) score = similarity;
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestProgram = program;
    }
  }

  return bestScore >= 0.5 ? bestProgram : null;
}

export interface ProgramMatchResult<T> {
  program: T | null;
  minor: T | null;
}

export function findBestMatchingProgram<T extends { title: string }>(
  transcriptText: string,
  programs: T[],
  minors: T[] = [],
): ProgramMatchResult<T> {
  if (programs.length === 0 || !transcriptText.trim()) {
    return { program: null, minor: null };
  }

  const segment = getLastSemesterSegment(transcriptText);
  const searchText = segment.trim().length >= 20 ? segment : transcriptText;
  const { main: mainFragment, minor: minorFragment } =
    extractProgramBetweenTermAndCourse(searchText);

  let program = mainFragment ? findClosestTitle(mainFragment, programs, 0.6) : null;
  if (!program) {
    program = findProgramByMultilineFallback(searchText, programs);
  }

  const minor =
    minorFragment && minors.length > 0 ? findClosestTitle(minorFragment, minors, 0.6) : null;

  return { program, minor };
}
