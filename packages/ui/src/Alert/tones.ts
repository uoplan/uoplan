export type AlertTone = "info" | "success" | "warning" | "danger" | "neutral";

/** Mantine colour name for each alert tone (web adapter). */
export const ALERT_MANTINE_COLOR: Record<AlertTone, string> = {
  info: "blue",
  success: "green",
  warning: "orange",
  danger: "red",
  neutral: "gray",
};
