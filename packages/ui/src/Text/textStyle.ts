import type { TextWeight } from "./Text.types";

/** Numeric font-weight for each semantic weight token (shared by both adapters). */
export const TEXT_FONT_WEIGHT: Record<TextWeight, number> = {
  regular: 400,
  medium: 500,
  semibold: 600,
  bold: 700,
};
