/**
 * Pure (platform-agnostic, no I/O) logic for turning the web token source
 * (`apps/web/src/styles/tokens.css`) into a React Native colour map.
 *
 * The web tokens are authored in `oklch()` / `color-mix()` — colour spaces RN's
 * colour parser does not understand — so each colour token is resolved here to a
 * plain `#rrggbb` / `rgba(...)` string. This module is consumed by:
 *   - `scripts/generate-native-tokens.ts` (reads the CSS, writes the committed
 *     `nativeTokens.gen.ts`, and re-checks it for drift via `--check`), and
 *   - `src/__tests__/tokens.test.ts` (unit-tests the pure conversion logic).
 *
 * Keep this file free of `node:*`/DOM imports so the package stays
 * platform-agnostic.
 */

/** Theme ids, in the order they should appear in the generated file. */
export const THEME_IDS = ["dark", "light", "geegees"] as const;

// ---------------------------------------------------------------------------
// oklch → sRGB (Björn Ottosson's reference conversion).
// ---------------------------------------------------------------------------

/** Gamma-encode one linear-light channel in [0,1]. */
function linearToSrgb(c: number): number {
  const v = c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

/** Convert oklch (L 0..1, C >= 0, hue degrees) to 0..255 integer sRGB channels. */
function oklchToRgb(L: number, C: number, hDeg: number): { r: number; g: number; b: number } {
  const h = (hDeg * Math.PI) / 180;
  const a = C * Math.cos(h);
  const b = C * Math.sin(h);

  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const rLin = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const gLin = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bLin = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return {
    r: Math.round(linearToSrgb(rLin) * 255),
    g: Math.round(linearToSrgb(gLin) * 255),
    b: Math.round(linearToSrgb(bLin) * 255),
  };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function round(n: number): string {
  return String(Math.round(n * 1000) / 1000);
}

// ---------------------------------------------------------------------------
// tokens.css parsing + colour-value resolution.
// ---------------------------------------------------------------------------

/**
 * Parse the `[data-app-theme="<id>"]` (and `:root`) blocks into per-theme
 * `--app-*` → raw-value maps. Custom properties not redefined by a theme block
 * inherit from `:root` (== the dark theme), mirroring the CSS cascade.
 */
function parseTokensCss(css: string): Record<string, Record<string, string>> {
  const blocks: Record<string, Record<string, string>> = {};
  const blockRe = /([^{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(css)) !== null) {
    const selectors = m[1];
    const body = m[2];
    const map: Record<string, string> = {};
    const declRe = /(--[a-z0-9-]+)\s*:\s*([^;]+);/gi;
    let d: RegExpExecArray | null;
    while ((d = declRe.exec(body)) !== null) {
      map[d[1].trim()] = d[2].trim();
    }
    const ids: string[] = [];
    if (/:root/.test(selectors)) ids.push("dark");
    for (const tm of selectors.matchAll(/\[data-app-theme="([^"]+)"\]/g)) ids.push(tm[1]);
    for (const id of ids) {
      blocks[id] = { ...blocks[id], ...map };
    }
  }
  return blocks;
}

/** A raw value is a colour if it resolves to something RN can render. */
function isColorValue(value: string): boolean {
  return (
    /^oklch\(/i.test(value) ||
    /^rgba?\(/i.test(value) ||
    value.startsWith("#") ||
    /^color-mix\(/i.test(value) ||
    value === "transparent" ||
    /^var\(--app-[a-z0-9-]+\)$/i.test(value)
  );
}

/**
 * Resolve a single token's raw CSS value to an RN colour string, following
 * `var()` references within the merged theme map and collapsing
 * `oklch()` / `color-mix(..., transparent)`. Returns null for non-colours.
 */
export function resolveColor(
  value: string,
  themeMap: Record<string, string>,
  depth = 0,
): string | null {
  if (depth > 8) return null;
  const v = value.trim();

  if (v === "transparent") return "transparent";

  const varRef = v.match(/^var\((--app-[a-z0-9-]+)\)$/i);
  if (varRef) {
    const target = themeMap[varRef[1]];
    if (target == null) return null;
    return resolveColor(target, themeMap, depth + 1);
  }

  if (v.startsWith("#") || /^rgba?\(/i.test(v)) {
    return v.replaceAll(/\s+/g, " ");
  }

  const oklch = v.match(/^oklch\(\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\)$/i);
  if (oklch) {
    return rgbToHex(oklchToRgb(Number(oklch[1]), Number(oklch[2]), Number(oklch[3])));
  }

  const mix = v.match(
    /^color-mix\(\s*in\s+oklab\s*,\s*(.+?)\s+([0-9.]+)%\s*,\s*transparent\s*\)$/i,
  );
  if (mix) {
    const base = resolveColor(mix[1], themeMap, depth + 1);
    const alpha = Number(mix[2]) / 100;
    if (base == null) return null;
    const hex = base.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (hex) {
      const r = parseInt(hex[1], 16);
      const g = parseInt(hex[2], 16);
      const b = parseInt(hex[3], 16);
      return `rgba(${r}, ${g}, ${b}, ${round(alpha)})`;
    }
    return null;
  }

  return null;
}

/**
 * Build the `{ [themeId]: { [tokenKey]: colorString } }` map. Token keys are the
 * `--app-` prefix-stripped names (e.g. `--app-surface-hover` → `surface-hover`).
 */
export function generateNativeTokens(css: string): Record<string, Record<string, string>> {
  const blocks = parseTokensCss(css);
  const dark = blocks.dark ?? {};

  const out: Record<string, Record<string, string>> = {};
  const colorKeys = Object.keys(dark)
    .filter((k) => k.startsWith("--app-") && isColorValue(dark[k]))
    .sort();

  for (const id of THEME_IDS) {
    const merged = { ...dark, ...blocks[id] };
    const themeColors: Record<string, string> = {};
    for (const key of colorKeys) {
      const resolved = resolveColor(merged[key], merged);
      if (resolved != null) {
        themeColors[key.replace(/^--app-/, "")] = resolved;
      }
    }
    out[id] = themeColors;
  }
  return out;
}

/** Render the committed `nativeTokens.gen.ts` module text. */
export function renderModule(tokens: Record<string, Record<string, string>>): string {
  const body = JSON.stringify(tokens, null, 2);
  return `// AUTO-GENERATED by scripts/generate-native-tokens.ts — DO NOT EDIT.
// Source of truth: apps/web/src/styles/tokens.css. Regenerate with
// \`pnpm --filter @uoplan/theme generate:tokens\`; \`check:tokens\` (CI) fails
// if this file drifts from the source.

/** Resolved per-theme colour tokens, ready for React Native style values. */
export const NATIVE_THEME_COLORS = ${body} as const;
`;
}
