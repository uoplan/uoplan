import { createCanvas } from "@napi-rs/canvas";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DEFAULT_SCHOOL_ID, SCHOOLS } from "@uoplan/domain/school";
import type { SchoolId } from "@uoplan/domain/school";
import { schoolDataPaths, schoolsWithData } from "./school-data.ts";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "../public");

// Shared card palette — identical for every school; only the accent-derived
// values in `OgTheme` vary.
const BG = "#141414";
const CREAM = "#F5F2EC";
const CREAM2 = "#B8B2A6";

interface Term {
  name: string;
}

// ─── Shared layout constants (must not change — used in the uOttawa image) ────

const W = 1200;
const H = Math.round(630 * 0.7); // 441 — shorter OG card
const PAD = 56;
const LOGO_Y = 128;

// ─── uOttawa — exact original drawing (must stay byte-identical) ──────────────

const UOTTAWA_SAMPLE_CODES = [
  "CSI 2110",
  "MAT 1320",
  "PHY 1121",
  "ENG 1100",
  "ECO 1102",
  "CSI 3530",
  "ITI 1120",
  "MAT 2122",
  "CHM 1311",
  "BIO 1130",
  "GEG 2320",
  "PHI 1101",
  "PSY 1101",
  "SOC 1101",
  "HIS 2129",
  "CSI 4180",
  "MAT 3121",
  "PHY 2323",
  "ENG 2100",
  "ECO 2143",
  "CSI 3540",
  "ITI 1121",
  "MAT 2362",
  "CHM 1321",
  "BIO 2133",
];

/**
 * Everything that differs between one school's OG card and another's.
 *
 * uOttawa's palette and course-code watermark are **pinned literals** rather
 * than derived from the school registry: `/og-image.png` is already referenced
 * by social cards in the wild, and the file must stay byte-identical. Every
 * other school derives its theme from its registry accent colour, so adding a
 * school needs no change here.
 */
interface OgTheme {
  /** Left edge accent bar. */
  bar: string;
  /** "uoplan.party" in the footer. */
  footer: string;
  /** Term badge fill. */
  badgeDim: string;
  /** Term badge label. */
  badgeText: string;
  /** Course codes tiled as the background watermark. */
  sampleCodes: string[];
  tagline: string;
}

const PINNED_THEMES: Partial<Record<SchoolId, Omit<OgTheme, "sampleCodes" | "tagline">>> = {
  uottawa: {
    bar: "#6B2080",
    footer: "#BE4BDB",
    badgeDim: "rgba(190,75,219,0.2)",
    badgeText: "#DA77F2",
  },
};

/** Evenly sample across the full list so different disciplines are represented. */
function pickSampleCodes(allCodes: string[], count = 25): string[] {
  if (allCodes.length <= count) return allCodes;
  const step = Math.floor(allCodes.length / count);
  return Array.from({ length: count }, (_, i) => allCodes[i * step]!);
}

function themeFor(school: SchoolId, courses: string[]): OgTheme {
  const entry = SCHOOLS[school];
  const accent = entry.accentColor;
  const pinned = PINNED_THEMES[school];
  return {
    bar: pinned?.bar ?? accent,
    footer: pinned?.footer ?? accent,
    badgeDim: pinned?.badgeDim ?? `${accent}33`,
    // Readable against any hue, unlike a tinted label.
    badgeText: pinned?.badgeText ?? CREAM,
    sampleCodes: school === DEFAULT_SCHOOL_ID ? UOTTAWA_SAMPLE_CODES : pickSampleCodes(courses),
    tagline: `${entry.shortName} course planner & schedule generator`,
  };
}

function generateOgBuffer(
  theme: OgTheme,
  terms: Term[],
  courses: unknown[],
  programs: unknown[],
  professors: unknown[],
): Buffer {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);

  // Course code watermark — right half, staggered rows
  ctx.font = "300 13px monospace";
  ctx.fillStyle = "#FFFFFF";
  ctx.globalAlpha = 0.055;
  const codeW = 110;
  const codeH = 28;
  const cols = Math.ceil((W * 0.55) / codeW);
  const rows = Math.ceil(H / codeH);
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (codeW / 2);
    for (let c = 0; c < cols + 1; c++) {
      const x = W * 0.45 + c * codeW - offset;
      const y = r * codeH + 14;
      const code = theme.sampleCodes[(r * cols + c) % theme.sampleCodes.length];
      ctx.fillText(code, x, y);
    }
  }
  ctx.globalAlpha = 1;

  // Subtle vertical gradient vignette over right side
  const vignette = ctx.createLinearGradient(W * 0.4, 0, W, 0);
  vignette.addColorStop(0, BG);
  vignette.addColorStop(0.35, "transparent");
  vignette.addColorStop(1, "rgba(20,20,20,0.7)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, W, H);

  // Left accent bar
  ctx.fillStyle = theme.bar;
  ctx.fillRect(0, 0, 5, H);

  // Logo
  ctx.font = "bold 88px Georgia";
  ctx.fillStyle = CREAM;
  ctx.fillText("uoPlan", PAD, LOGO_Y);

  // Term badges (one per term)
  ctx.font = "500 11px monospace";
  const BADGE_Y = LOGO_Y + 18;
  const BADGE_H = 22;
  let badgeX = PAD;
  for (const term of terms) {
    const label = term.name;
    const badgeW = ctx.measureText(label).width + 20;
    ctx.fillStyle = theme.badgeDim;
    ctx.fillRect(badgeX, BADGE_Y, badgeW, BADGE_H);
    ctx.fillStyle = theme.badgeText;
    ctx.fillText(label, badgeX + 10, BADGE_Y + 15);
    badgeX += badgeW + 8;
  }

  // Divider
  const DIV_Y = LOGO_Y + 52;
  ctx.strokeStyle = "#3D3832";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, DIV_Y);
  ctx.lineTo(W * 0.58, DIV_Y);
  ctx.stroke();

  // Tagline
  ctx.font = "400 18px monospace";
  ctx.fillStyle = CREAM2;
  ctx.fillText(theme.tagline, PAD, DIV_Y + 28);

  // Stats row
  const stats = [
    { value: courses.length.toLocaleString(), label: "courses" },
    { value: programs.length.toLocaleString(), label: "programs" },
    { value: professors.length.toLocaleString(), label: "professors" },
  ];

  const STAT_Y = DIV_Y + 76;
  let statX = PAD;
  const statGap = 20;

  ctx.font = "bold 32px monospace";
  for (const { value, label } of stats) {
    const numW = ctx.measureText(value).width;
    ctx.fillStyle = CREAM;
    ctx.fillText(value, statX, STAT_Y);

    ctx.font = "300 12px monospace";
    ctx.fillStyle = CREAM2;
    ctx.fillText(label, statX, STAT_Y + 18);
    ctx.font = "bold 32px monospace";

    statX += numW + statGap + ctx.measureText(label).width * 0.5 + 40;
  }

  // Bottom row
  const FOOTER_Y = H - 40;

  ctx.font = "500 14px monospace";
  ctx.fillStyle = theme.footer;
  ctx.fillText("uoplan.party", PAD, FOOTER_Y);

  const urlW = ctx.measureText("uoplan.party").width;
  ctx.fillStyle = "#3D3832";
  ctx.beginPath();
  ctx.arc(PAD + urlW + 14, FOOTER_Y - 5, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.font = "300 14px monospace";
  ctx.fillStyle = CREAM2;
  ctx.fillText("Free. No account needed.", PAD + urlW + 26, FOOTER_Y);

  return canvas.toBuffer("image/png");
}

// ─── Main loop ────────────────────────────────────────────────────────────────

const schools = schoolsWithData();

for (const school of schools) {
  try {
    const { termsPath, indicesPath, ratemyprofessorsPath } = schoolDataPaths(school);
    const { terms } = JSON.parse(readFileSync(termsPath, "utf8")) as { terms: Term[] };
    const { courses, programs } = JSON.parse(readFileSync(indicesPath, "utf8")) as {
      courses: string[];
      programs: unknown[];
    };
    const { professors } = JSON.parse(readFileSync(ratemyprofessorsPath, "utf8")) as {
      professors: unknown[];
    };

    const { pathSlug } = SCHOOLS[school];
    const outDir = pathSlug ? join(publicDir, pathSlug) : publicDir;
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, "og-image.png");

    const buf = generateOgBuffer(themeFor(school, courses), terms, courses, programs, professors);

    writeFileSync(outPath, buf);
    console.log(
      `OG image written to ${outPath} — ${terms.map((t) => t.name).join(", ")} · ${String(courses.length)} courses · ${String(programs.length)} programs · ${String(professors.length)} professors`,
    );
  } catch (err) {
    console.warn(
      `OG image: skipping ${school} — ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
