// Leaf text primitives shared across the prerequisite parser modules. No
// dependencies on the non-course/sentence/clause layers, so they can be imported
// freely without introducing cycles.

export function parseCreditRequirement(text: string): number | undefined {
  // Match both English (credit/credits) and French (crédit/crédits/unit/unités)
  const match = text.match(/(\d+(?:\.\d+)?)[^0-9]*?(?:units?|cr[ée]dits?|unit[ée]s?)\b/i);
  if (!match) return undefined;
  const value = parseFloat(match[1]);
  return Number.isNaN(value) ? undefined : value;
}

export function extractDisciplines(text: string): string[] {
  const disciplineRegex = /\(([A-Z]{3,4})\)/g;
  const disciplines: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = disciplineRegex.exec(text)) !== null) disciplines.push(match[1]);
  return Array.from(new Set(disciplines));
}

export function splitTopLevel(text: string, separators: RegExp): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);

    if (depth === 0) {
      const rest = text.slice(i);
      const m = rest.match(separators);
      if (m && m.index === 0) {
        if (current.trim()) parts.push(current.trim());
        current = "";
        i += m[0].length - 1;
        continue;
      }
    }

    current += ch;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

/** Remove one outer `(...)` layer when the whole string is a single balanced group. */
export function stripOuterParensOnce(inner: string): string | undefined {
  if (!inner.startsWith("(") || !inner.endsWith(")")) return undefined;
  let depth2 = 0;
  let wrapsAll = true;
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i];
    if (ch === "(") {
      depth2++;
    } else if (ch === ")") {
      depth2--;
      if (depth2 === 0 && i < inner.length - 1) {
        wrapsAll = false;
        break;
      }
    }
    if (depth2 < 0) {
      wrapsAll = false;
      break;
    }
  }
  if (wrapsAll && depth2 === 0) {
    return inner.slice(1, -1).trim();
  }
  return undefined;
}
