// Extraction of the prerequisite sentence from bilingual catalogue prose (the
// "Prerequisites: … / Préalables : …" fragment) plus first-sentence trimming.

const EN_PREREQ_LABEL_SOURCE = String.raw`(?:P?Prerequisites?|Prererequisites?|Prerequistes?)`;
const FR_PREREQ_LABEL_SOURCE = String.raw`(?:P?Pr[ée]alables?|Pr[ée]requis?s?)`;
const ANY_PREREQ_LABEL_SOURCE = String.raw`(?:${EN_PREREQ_LABEL_SOURCE}|${FR_PREREQ_LABEL_SOURCE})`;

function prereqLabelRegex(source: string, flags = "i"): RegExp {
  return new RegExp(source, flags);
}

export function extractPrereqSentence(raw: string): string | undefined {
  const normalized = raw.replaceAll(/\s+/g, " ").trim();
  if (!normalized) return undefined;

  // Bilingual entries carry both labels; extract whichever version appears first.
  const englishLabel = prereqLabelRegex(`${EN_PREREQ_LABEL_SOURCE}\\s*[:：]`);
  const frenchLabel = prereqLabelRegex(`${FR_PREREQ_LABEL_SOURCE}\\s*[:：]`);
  const hasEnglishLabel = englishLabel.test(normalized);
  const hasFrenchLabel = frenchLabel.test(normalized);

  if (hasEnglishLabel && hasFrenchLabel) {
    const englishMatch = normalized.match(englishLabel);
    const frenchMatch = normalized.match(frenchLabel);

    if (englishMatch && frenchMatch) {
      const englishPos = englishMatch.index ?? 0;
      const frenchPos = frenchMatch.index ?? 0;

      if (englishPos < frenchPos) {
        // English comes first - extract until "/ Préalable" or end
        const textMatch = normalized.match(
          prereqLabelRegex(
            `${EN_PREREQ_LABEL_SOURCE}\\s*[:：]\\s*(.*?)(?:\\s*\\/\\s*${FR_PREREQ_LABEL_SOURCE}|$)`,
          ),
        );
        if (textMatch && textMatch[1]) {
          return extractFirstSentence(textMatch[1].trim());
        }
      } else {
        // French comes first - extract until "/ Prerequisite" or end
        const textMatch = normalized.match(
          prereqLabelRegex(
            `${FR_PREREQ_LABEL_SOURCE}\\s*[:：]\\s*(.*?)(?:\\s*\\/\\s*${EN_PREREQ_LABEL_SOURCE}|$)`,
          ),
        );
        if (textMatch && textMatch[1]) {
          return extractFirstSentence(textMatch[1].trim());
        }
      }
    }
  }

  const labelRegex = prereqLabelRegex(`${ANY_PREREQ_LABEL_SOURCE}\\s*[:：]\\s*`);
  if (!labelRegex.test(normalized)) return undefined;

  const afterLabel = normalized.replace(
    prereqLabelRegex(`^(.*?)${ANY_PREREQ_LABEL_SOURCE}\\s*[:：]\\s*`),
    "",
  );
  const trimmed = afterLabel.trim();
  if (!trimmed) return undefined;

  // Find sentence boundary, but be smart about abbreviations
  // Common abbreviations that contain periods: B.Com, B.A., M.A., M.Sc., Ph.D., etc.
  // Also single letters in parentheses like (B) or (B.A.)
  let sentenceEnd = -1;
  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === ".") {
      const before = trimmed.slice(Math.max(0, i - 10), i);
      const after = trimmed.slice(i + 1, Math.min(trimmed.length, i + 20));

      // Could be B., M., etc. - likely part of abbreviation like B.Com, M.Sc.
      if (
        (/\b[A-Z]$/.test(before) || /\b[A-Z]\.$/.test(before)) &&
        /^[A-Za-z]/.test(after) &&
        !/^[A-Z]/.test(after)
      ) {
        continue;
      }

      // Period inside parentheses - likely abbreviation context like (B.A.)
      const parenBefore = trimmed.slice(0, i).lastIndexOf("(");
      const parenAfter = trimmed.indexOf(")", i);
      if (parenBefore !== -1 && parenAfter !== -1 && parenAfter > i) {
        const parenContent = trimmed.slice(parenBefore, parenAfter + 1);
        if (/\([A-Z][.]?\)/.test(parenContent)) {
          continue;
        }
      }

      // Sentence-ending period: end of string, followed by space+capital, or
      // right before a bilingual separator like " / Prerequisites:".
      const afterPeriod = trimmed.slice(i, i + 20);
      if (
        i === trimmed.length - 1 ||
        /\s+[A-Z]/.test(trimmed.slice(i, i + 3)) ||
        prereqLabelRegex(`\\s*\\/\\s*${ANY_PREREQ_LABEL_SOURCE}`).test(afterPeriod)
      ) {
        sentenceEnd = i;
        break;
      }
    }
  }

  const sentence = (sentenceEnd === -1 ? trimmed : trimmed.slice(0, sentenceEnd)).trim();
  return sentence || undefined;
}

function extractFirstSentence(text: string): string | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  for (let i = 0; i < trimmed.length; i++) {
    if (trimmed[i] === ".") {
      const before = trimmed.slice(Math.max(0, i - 2), i);
      const after = trimmed.slice(i + 1, Math.min(trimmed.length, i + 3));

      // Skip decimal numbers (digit.digit)
      if (/\d$/.test(before) && /^\d/.test(after)) {
        continue;
      }

      if (/\s+[A-Z]/.test(trimmed.slice(i, i + 3))) {
        return trimmed.slice(0, i).trim();
      }
    }
  }

  // Strip trailing period if present
  return trimmed.replace(/\.$/, "").trim();
}
