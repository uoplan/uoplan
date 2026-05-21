type CalendarVariant = "basic" | "advanced";

let _mode: CalendarVariant | null = null;

/** Called by CalendarPage on mount/unmount to set the active generation mode. */
export function setCalendarMode(mode: CalendarVariant | null): void {
  _mode = mode;
}

/** Mode stored in share protobuf when encoding from the current calendar state. */
export function wizardModeForEncoding(_pathname: string): CalendarVariant | null {
  return _mode;
}

export function isBasicPlannerActive(): boolean {
  return _mode === "basic";
}

export function isAdvancedPlannerActive(): boolean {
  return _mode === "advanced";
}

export function isPlannerVariantActive(): boolean {
  return _mode !== null;
}
