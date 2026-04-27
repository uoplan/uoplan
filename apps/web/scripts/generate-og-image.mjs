import { createCanvas } from "@napi-rs/canvas";
import { writeFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = resolve(__dirname, "../public/data");

// Load real data
const { terms }    = JSON.parse(readFileSync(join(dataDir, "terms.json"), "utf8"));
const { courses, programs } = JSON.parse(readFileSync(join(dataDir, "indices.json"), "utf8"));
const { professors } = JSON.parse(readFileSync(join(dataDir, "ratemyprofessors.json"), "utf8"));


const W = 1200;
const H = 630;
const canvas = createCanvas(W, H);
const ctx = canvas.getContext("2d");

// Theme
const BG     = "#141414";
const DARK2  = "#1E1E1E";
const CREAM  = "#F5F2EC";
const CREAM2 = "#B8B2A6";
const PURPLE = "#BE4BDB";
const PURPLE_BORDER = "#6B2080";
const PURPLE_DIM = "rgba(190,75,219,0.2)";
const PURPLE_TEXT = "#DA77F2";

// ── Background ──────────────────────────────────────────────────────────────
ctx.fillStyle = BG;
ctx.fillRect(0, 0, W, H);

// Course code watermark — right half, staggered rows
const SAMPLE_CODES = [
  "CSI 2110", "MAT 1320", "PHY 1121", "ENG 1100", "ECO 1102",
  "CSI 3530", "ITI 1120", "MAT 2122", "CHM 1311", "BIO 1130",
  "GEG 2320", "PHI 1101", "PSY 1101", "SOC 1101", "HIS 2129",
  "CSI 4180", "MAT 3121", "PHY 2323", "ENG 2100", "ECO 2143",
  "CSI 3540", "ITI 1121", "MAT 2362", "CHM 1321", "BIO 2133",
];
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
    const code = SAMPLE_CODES[(r * cols + c) % SAMPLE_CODES.length];
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

// ── Left accent bar ──────────────────────────────────────────────────────────
ctx.fillStyle = PURPLE_BORDER;
ctx.fillRect(0, 0, 5, H);

// ── Logo ─────────────────────────────────────────────────────────────────────
const PAD = 72;
const LOGO_Y = 200;

ctx.font = "bold 104px Georgia";
ctx.fillStyle = CREAM;
ctx.fillText("uoPlan", PAD, LOGO_Y);

// ── Term badges (one per term) ────────────────────────────────────────────────
ctx.font = "500 12px monospace";
const BADGE_Y = LOGO_Y + 22;
const BADGE_H = 24;
let badgeX = PAD;
for (const term of terms) {
  const label = term.name;
  const badgeW = ctx.measureText(label).width + 20;
  ctx.fillStyle = PURPLE_DIM;
  ctx.fillRect(badgeX, BADGE_Y, badgeW, BADGE_H);
  ctx.fillStyle = PURPLE_TEXT;
  ctx.fillText(label, badgeX + 10, BADGE_Y + 16);
  badgeX += badgeW + 8;
}

// ── Divider ───────────────────────────────────────────────────────────────────
const DIV_Y = LOGO_Y + 66;
ctx.strokeStyle = "#3D3832";
ctx.lineWidth = 1;
ctx.beginPath();
ctx.moveTo(PAD, DIV_Y);
ctx.lineTo(W * 0.58, DIV_Y);
ctx.stroke();

// ── Tagline ───────────────────────────────────────────────────────────────────
ctx.font = "400 22px monospace";
ctx.fillStyle = CREAM2;
ctx.fillText("uOttawa course planner & schedule generator", PAD, DIV_Y + 36);

// ── Stats row ─────────────────────────────────────────────────────────────────
const stats = [
  { value: courses.length.toLocaleString(), label: "courses" },
  { value: programs.length.toLocaleString(), label: "programs" },
  { value: professors.length.toLocaleString(), label: "professors" },
];

const STAT_Y = DIV_Y + 90;
let statX = PAD;
const statGap = 24;

ctx.font = "bold 38px monospace";
for (const { value, label } of stats) {
  const numW = ctx.measureText(value).width;
  ctx.fillStyle = CREAM;
  ctx.fillText(value, statX, STAT_Y);

  ctx.font = "300 14px monospace";
  ctx.fillStyle = CREAM2;
  ctx.fillText(label, statX, STAT_Y + 22);
  ctx.font = "bold 38px monospace";

  statX += numW + statGap + ctx.measureText(label).width * 0.5 + 40;
}

// Dots between stats
ctx.font = "300 14px monospace";
statX = PAD;
ctx.fillStyle = PURPLE;
for (let i = 0; i < stats.length - 1; i++) {
  const numW_n = ctx.measureText(stats[i].value).width + 40;
  // approximate dot position — just draw a sep line instead
}

// ── Bottom row ────────────────────────────────────────────────────────────────
const FOOTER_Y = H - 52;

ctx.font = "500 15px monospace";
ctx.fillStyle = PURPLE;
ctx.fillText("uoplan.party", PAD, FOOTER_Y);

const urlW = ctx.measureText("uoplan.party").width;
ctx.fillStyle = "#3D3832";
ctx.beginPath();
ctx.arc(PAD + urlW + 14, FOOTER_Y - 5, 3, 0, Math.PI * 2);
ctx.fill();

ctx.font = "300 15px monospace";
ctx.fillStyle = CREAM2;
ctx.fillText("Free. No account needed.", PAD + urlW + 26, FOOTER_Y);

const out = join(__dirname, "../public/og-image.png");
writeFileSync(out, canvas.toBuffer("image/png"));
console.log(`OG image written to ${out} — ${terms.map(t => t.name).join(", ")} · ${courses.length} courses · ${programs.length} programs · ${professors.length} professors`);
