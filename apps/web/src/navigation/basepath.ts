/** Prepend a router basepath to a basepath-relative path, avoiding a double slash. */
export function withBasepath(basepath: string | undefined, path: string): string {
  const trimmed = (basepath ?? "").replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "/") return path;
  return path === "/" ? trimmed : `${trimmed}${path}`;
}
