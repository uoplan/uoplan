// Group tokens have the shape "group:PREFIX" (e.g. "group:CSI"). Real course codes
// always contain a space ("CSI 2101"), making the two formats unambiguous.
//
// For UI multi-selects that require unique option values, use
// `group:PREFIX~instance` (see `makeGroupTokenInstance`). The instance suffix is
// never part of the subject prefix.

const GROUP = "group:";

export function subjectPrefix(courseCode: string): string {
  return courseCode.split(/\s+/)[0]?.toUpperCase() ?? "";
}

export function isGroupToken(s: string): boolean {
  return s.startsWith(GROUP);
}

/** Subject/discipline code for this token (uppercase), without any instance suffix. */
export function groupTokenPrefix(s: string): string {
  const rest = s.slice(GROUP.length);
  const tilde = rest.indexOf("~");
  const raw = tilde >= 0 ? rest.slice(0, tilde) : rest;
  return raw.toUpperCase();
}

/** Canonical bare token `group:PREFIX` for counting / URL encoding. */
export function canonicalGroupToken(s: string): string {
  return makeGroupToken(groupTokenPrefix(s));
}

/** True when this is a bare `group:PREFIX` with no instance suffix. */
export function isBareGroupToken(s: string): boolean {
  return isGroupToken(s) && s === canonicalGroupToken(s);
}

export function makeGroupToken(prefix: string): string {
  return `${GROUP}${prefix.toUpperCase()}`;
}

/**
 * Unique value for one "Any PREFIX course" chip in a MultiSelect (or repeated
 * constrained picks). Encodes/decodes the same subject as `makeGroupToken(prefix)`.
 */
export function makeGroupTokenInstance(prefix: string): string {
  const id =
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
      ? globalThis.crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  return `${makeGroupToken(prefix)}~${id}`;
}
