export type CalendarVariant = "basic" | "advanced";

export function getCalendarVariantFromPath(pathname: string): CalendarVariant | null {
  if (pathname.includes("/calendar/basic")) return "basic";
  if (pathname.includes("/calendar/advanced")) return "advanced";
  return null;
}

export function isBasicCalendarPath(pathname: string): boolean {
  return getCalendarVariantFromPath(pathname) === "basic";
}

export function getActiveCalendarVariant(): CalendarVariant | null {
  if (typeof window === "undefined") return null;
  return getCalendarVariantFromPath(window.location.pathname);
}

/** Mode stored in share protobuf when encoding from the current page URL. */
export function wizardModeForEncoding(pathname: string): "basic" | "advanced" | null {
  return getCalendarVariantFromPath(pathname);
}

export function isBasicPlannerActive(): boolean {
  return getActiveCalendarVariant() === "basic";
}

export function isAdvancedPlannerActive(): boolean {
  return getActiveCalendarVariant() === "advanced";
}

export function isPlannerVariantActive(): boolean {
  return getActiveCalendarVariant() != null;
}
