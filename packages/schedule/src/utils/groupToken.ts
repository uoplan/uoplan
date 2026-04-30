// Group tokens have the shape "group:PREFIX" (e.g. "group:CSI"). Real course codes
// always contain a space ("CSI 2101"), making the two formats unambiguous.

export function subjectPrefix(courseCode: string): string {
  return courseCode.split(/\s+/)[0]?.toUpperCase() ?? "";
}

export function isGroupToken(s: string): boolean {
  return s.startsWith("group:");
}

export function groupTokenPrefix(s: string): string {
  return s.slice("group:".length);
}

export function makeGroupToken(prefix: string): string {
  return `group:${prefix}`;
}
