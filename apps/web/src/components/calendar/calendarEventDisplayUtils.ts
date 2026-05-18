/** Matches `useCalendarEvents` (`${comp} - ${sectionCode}`). */
const COMPONENT_SECTION_SEP = " - ";

export function componentKindOnly(componentSection: string): string {
  const i = componentSection.indexOf(COMPONENT_SECTION_SEP);
  return (i >= 0 ? componentSection.slice(0, i) : componentSection).trim();
}

/**
 * Formats time range from minutes since midnight to 24-hour format string.
 */
export function formatTimeRange(startMinutes: number, endMinutes: number): string {
  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, "0")}:${mins.toString().padStart(2, "0")}`;
  };

  return `${formatTime(startMinutes)} - ${formatTime(endMinutes)}`;
}
