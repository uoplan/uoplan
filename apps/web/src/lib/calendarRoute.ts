type CalendarVariant = "basic" | "advanced";

function getCalendarVariantFromPath(pathname: string): CalendarVariant | null {
  if (pathname.includes("/schedule/calendar/basic")) return "basic";
  if (pathname.includes("/schedule/calendar/advanced")) return "advanced";
  return null;
}

function getActiveCalendarVariant(): CalendarVariant | null {
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
