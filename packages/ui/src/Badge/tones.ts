export type BadgeTone = "accent" | "neutral" | "danger" | "success" | "warning";

/** Soft background + foreground colours for each badge tone (shared by both adapters). */
export const BADGE_TONES: Record<BadgeTone, { bg: string; fg: string }> = {
  accent: { bg: "#e4eefd", fg: "#2f5fa6" },
  neutral: { bg: "#f0ede8", fg: "#5e5a52" },
  danger: { bg: "#fdecec", fg: "#b4302d" },
  success: { bg: "#e6f4ea", fg: "#2f7a4a" },
  warning: { bg: "#fdf0e0", fg: "#9a5a17" },
};
