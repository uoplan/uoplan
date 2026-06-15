import { Linking } from "react-native";

const GRAPH_WEB_URL = "https://uoplan.party/graph";

export interface DeepLinkMapping {
  redirect: string;
  openExternal?: string;
}

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

function pathnameFromDeepLink(path: string): string {
  const url = new URL(path, "uoplan://uoplan.party");
  const hostnameAsPath =
    url.protocol === "uoplan:" && url.hostname && url.hostname !== "uoplan.party";
  const pathname =
    hostnameAsPath && (!url.pathname || url.pathname === "/") ? `/${url.hostname}` : url.pathname;
  return trimTrailingSlash(pathname || "/");
}

export function mapDeepLinkPath(path: string): DeepLinkMapping {
  try {
    const pathname = pathnameFromDeepLink(path);
    if (pathname === "/changelog") return { redirect: "/more/changelog" };
    if (pathname === "/graph") return { redirect: "/", openExternal: GRAPH_WEB_URL };
    return { redirect: path };
  } catch {
    return { redirect: path };
  }
}

export function redirectSystemPath({
  path,
}: {
  path: string | null;
  initial: boolean;
}): string | null {
  if (path == null) return path;

  try {
    const { redirect, openExternal } = mapDeepLinkPath(path);
    if (openExternal) {
      try {
        void Linking.openURL(openExternal).catch(() => {});
      } catch {
        // Keep native deep-link handling non-throwing, even if the platform URL API fails.
      }
    }
    return redirect;
  } catch {
    return path;
  }
}
