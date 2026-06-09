/**
 * Connection-aware preload strategy for TanStack Router.
 *
 * Returns `"intent"` so route chunks prefetch on link hover/focus, except when the
 * user has opted into Save-Data or is on a slow connection (`slow-2g` / `2g`), where
 * we return `false` to avoid spending their bandwidth on speculative chunk loads.
 */
export type PreloadStrategy = "intent" | false;

interface NetworkInformationLike {
  saveData?: boolean;
  effectiveType?: string;
}

function readConnection(): NetworkInformationLike | undefined {
  if (typeof navigator === "undefined") return undefined;
  return (navigator as Navigator & { connection?: NetworkInformationLike }).connection;
}

export function shouldEnablePreload(
  connection: NetworkInformationLike | undefined = readConnection(),
): PreloadStrategy {
  if (connection?.saveData) return false;
  const effectiveType = connection?.effectiveType;
  if (effectiveType === "slow-2g" || effectiveType === "2g") return false;
  return "intent";
}
