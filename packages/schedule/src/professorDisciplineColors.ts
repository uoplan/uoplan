/**
 * Discipline → category → hue palette for professor graph node colours.
 * Similar disciplines share a category; each code gets a nearby hue within it.
 */

export type DisciplineCategory =
  | "computing"
  | "engineering"
  | "physical_science"
  | "life_science"
  | "health_medicine"
  | "psychology"
  | "social_science"
  | "humanities"
  | "language"
  | "business"
  | "arts"
  | "education"
  | "law"
  | "communication"
  | "other";

type CategoryPalette = {
  hue: number;
  hueSpread: number;
  saturation: number;
  lightness: number;
};

const CATEGORY_PALETTE: Record<DisciplineCategory, CategoryPalette> = {
  computing: { hue: 258, hueSpread: 28, saturation: 62, lightness: 58 },
  engineering: { hue: 205, hueSpread: 26, saturation: 58, lightness: 52 },
  physical_science: { hue: 198, hueSpread: 32, saturation: 55, lightness: 50 },
  life_science: { hue: 142, hueSpread: 30, saturation: 52, lightness: 48 },
  health_medicine: { hue: 168, hueSpread: 36, saturation: 48, lightness: 52 },
  psychology: { hue: 285, hueSpread: 12, saturation: 55, lightness: 56 },
  social_science: { hue: 24, hueSpread: 34, saturation: 58, lightness: 54 },
  humanities: { hue: 38, hueSpread: 28, saturation: 52, lightness: 56 },
  language: { hue: 318, hueSpread: 32, saturation: 54, lightness: 56 },
  business: { hue: 48, hueSpread: 22, saturation: 62, lightness: 50 },
  arts: { hue: 332, hueSpread: 30, saturation: 58, lightness: 58 },
  education: { hue: 88, hueSpread: 24, saturation: 50, lightness: 52 },
  law: { hue: 12, hueSpread: 16, saturation: 55, lightness: 46 },
  communication: { hue: 350, hueSpread: 18, saturation: 56, lightness: 54 },
  other: { hue: 220, hueSpread: 40, saturation: 28, lightness: 52 },
};

/** Discipline codes grouped by faculty area (161 codes in grades data). */
const CATEGORY_DISCIPLINES: Record<DisciplineCategory, readonly string[]> = {
  computing: [
    "CSI",
    "SEG",
    "SDS",
    "ISI",
    "SYS",
    "ITI",
    "CGI",
    "CPT",
    "CPL",
    "DCC",
    "DTI",
    "ISP",
    "IAI",
    "ILA",
    "BIM",
    "API",
    "PCS",
    "SCS",
    "SEC",
  ],
  engineering: ["ELG", "CEG", "CVG", "ELE", "ERG", "GNG", "EVG", "EVS", "ENV", "EMP", "EVD", "GAE"],
  physical_science: ["MAT", "PHY", "CHM", "GEO", "GEG", "EAS", "GRT"],
  life_science: ["BIO", "BCH", "MIC", "TOX", "BNF", "BPS"],
  health_medicine: [
    "MCG",
    "MHA",
    "MHS",
    "MDV",
    "MED",
    "NSG",
    "NUT",
    "DVM",
    "PHA",
    "PHR",
    "PHS",
    "PHT",
    "OBG",
    "OMT",
    "OPH",
    "ORA",
    "ORT",
    "ANA",
    "ANE",
    "ANP",
    "IMM",
    "INR",
    "RAD",
    "URO",
    "PME",
    "POP",
    "EPI",
    "DHN",
    "DCN",
    "CLI",
    "CLT",
    "AMM",
    "AMT",
    "BMG",
    "BML",
    "NSC",
    "NOT",
    "NAP",
    "REA",
    "SAI",
    "HMG",
    "HAH",
    "PAP",
    "PCT",
    "PAE",
    "YDD",
    "BIL",
    "LSR",
    "APA",
  ],
  psychology: ["PSY"],
  social_science: [
    "SOC",
    "POL",
    "CRM",
    "ECO",
    "ANT",
    "FSS",
    "HSS",
    "SSS",
    "FEM",
    "CDN",
    "ASI",
    "AFR",
    "GSU",
    "SCI",
    "PIP",
    "PLN",
    "FAM",
  ],
  humanities: ["HIS", "PHI", "ENG", "LIN", "CLA", "CHG", "SRS", "JCS", "LCL", "LCM"],
  language: [
    "FRA",
    "FRE",
    "FLS",
    "ESP",
    "ESL",
    "ITA",
    "JPN",
    "CHN",
    "RUS",
    "POR",
    "ARB",
    "ALG",
    "AHL",
    "TRA",
    "TSO",
    "EFR",
    "ELA",
  ],
  business: ["ADM", "MBA", "MGT", "TMM"],
  arts: ["MUS", "ART", "THE", "CIN", "DRC"],
  education: ["EDU", "PED", "EED", "SED"],
  law: ["DCL", "CML", "LLM"],
  communication: ["CMN", "JOU"],
  other: ["ACP", "CTS", "DLS", "ECH", "CMM"],
};

const DISCIPLINE_CATEGORY = new Map<string, DisciplineCategory>();
const DISCIPLINE_INDEX_IN_CATEGORY = new Map<string, number>();

for (const [category, codes] of Object.entries(CATEGORY_DISCIPLINES) as [
  DisciplineCategory,
  readonly string[],
][]) {
  codes.forEach((code, index) => {
    DISCIPLINE_CATEGORY.set(code, category);
    DISCIPLINE_INDEX_IN_CATEGORY.set(code, index);
  });
}

const DEFAULT_NODE_COLOR = "#868e96";

function hashDiscipline(code: string): number {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h * 31 + code.charCodeAt(i)) | 0;
  return (h & 0xffff) / 0xffff;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sat = s / 100;
  const light = l / 100;
  const c = (1 - Math.abs(2 * light - 1)) * sat;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = light - c / 2;
  let r: number;
  let g: number;
  let b: number;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const clamp = (n: number) => Math.max(0, Math.min(255, Math.round(n)));
  return `#${[clamp(r), clamp(g), clamp(b)].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

export function disciplineCategory(code: string): DisciplineCategory {
  return DISCIPLINE_CATEGORY.get(code.toUpperCase()) ?? "other";
}

/** Single discipline colour on the dark graph background. */
export function colorForDiscipline(code: string): string {
  const upper = code.toUpperCase();
  const category = disciplineCategory(upper);
  const palette = CATEGORY_PALETTE[category];
  const members = CATEGORY_DISCIPLINES[category];
  const idx = DISCIPLINE_INDEX_IN_CATEGORY.get(upper);
  const t = idx != null && members.length > 1 ? idx / (members.length - 1) : hashDiscipline(upper);
  const hue = palette.hue + t * palette.hueSpread;
  const [r, g, b] = hslToRgb(hue, palette.saturation, palette.lightness);
  return rgbToHex(r, g, b);
}

/** Weighted RGB blend of discipline colours (by section count). */
export function blendProfessorDisciplineColor(
  disciplineWeights: Readonly<Record<string, number>>,
): string {
  let total = 0;
  let r = 0;
  let g = 0;
  let b = 0;

  for (const [discipline, weight] of Object.entries(disciplineWeights)) {
    if (weight <= 0) continue;
    const hex = colorForDiscipline(discipline);
    const ri = parseInt(hex.slice(1, 3), 16);
    const gi = parseInt(hex.slice(3, 5), 16);
    const bi = parseInt(hex.slice(5, 7), 16);
    r += ri * weight;
    g += gi * weight;
    b += bi * weight;
    total += weight;
  }

  if (total <= 0) return DEFAULT_NODE_COLOR;
  return rgbToHex(r / total, g / total, b / total);
}
