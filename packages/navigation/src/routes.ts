/**
 * The platform-neutral route registry for the shared app. Screens describe
 * *where* they want to go with an {@link AppRoute} value; each platform adapter
 * (TanStack on web, Expo Router on native) translates the resulting path via
 * {@link routePath}. Keeping the route shapes + path-building here means a
 * screen written once navigates identically on web and native.
 *
 * Paths intentionally mirror the existing web URLs (apps/web/src/routes) so the
 * web adapter can pass them straight to TanStack, and the native route tree can
 * mirror the same structure as pages are ported.
 *
 * ## School prefix
 *
 * {@link routePath} intentionally produces **basepath-relative** paths with no
 * school prefix (e.g. `/schedule`, not `/carleton/schedule`). The school
 * prefix is the **adapter's** responsibility, not the route shape's:
 *
 * - **Web** (`WebNavigationProvider`): calls `withBasepath(router.basepath,
 *   routePath(route))` so TanStack Router's configured basepath (`/carleton`
 *   for Carleton, `` for uOttawa) is prepended once before pushing to history.
 * - **Native** (`NativeNavigationProvider`): passes `routePath(route)` directly
 *   to Expo Router as an `Href`. Native bundles only uOttawa data and the Expo
 *   file-based routes are uOttawa-only by design, so no prefix is needed.
 *
 * uOttawa's `pathSlug` is `""`, making `withBasepath` a no-op — preserving
 * existing URLs exactly.
 */
export type AppRoute =
  | { name: "home" }
  | { name: "explore"; query?: string }
  | { name: "course"; course: string }
  | { name: "discipline"; discipline: string }
  | { name: "faculty"; faculty: string }
  | { name: "professor"; slug: string }
  | { name: "program"; path: string }
  | { name: "trends" }
  | { name: "trendsCourses" }
  | { name: "trendsDisciplines" }
  | { name: "trendsLeaderboard" }
  | { name: "personalize"; step?: string }
  | { name: "schedule" }
  | { name: "graph"; professor?: string }
  | { name: "donate" }
  | { name: "changelog" };

/** The discriminant of {@link AppRoute} — useful for tab/active-state checks. */
export type AppRouteName = AppRoute["name"];

/** Build a `?key=value` query string (encoded), or "" when there are no pairs. */
function buildQuery(pairs: Record<string, string | undefined>): string {
  const parts = Object.entries(pairs)
    .filter((entry): entry is [string, string] => entry[1] !== undefined && entry[1] !== "")
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`);
  return parts.length > 0 ? `?${parts.join("&")}` : "";
}

/** Encode a single dynamic path segment. */
function seg(value: string): string {
  return encodeURIComponent(value);
}

/**
 * Translate an {@link AppRoute} into an absolute URL path (with query string
 * where applicable). Pure and exhaustively typed — adding a route variant
 * without handling it here is a compile error.
 */
export function routePath(route: AppRoute): string {
  switch (route.name) {
    case "home":
      return "/";
    case "explore":
      return `/explore${buildQuery({ q: route.query })}`;
    case "course":
      return `/explore/course/${seg(route.course)}`;
    case "discipline":
      return `/explore/discipline/${seg(route.discipline)}`;
    case "faculty":
      return `/explore/faculty/${seg(route.faculty)}`;
    case "professor":
      return `/explore/professor/${seg(route.slug)}`;
    case "program":
      return `/explore/program/${route.path.split("/").map(seg).join("/")}`;
    case "trends":
      return "/trends";
    case "trendsCourses":
      return "/trends/courses";
    case "trendsDisciplines":
      return "/trends/disciplines";
    case "trendsLeaderboard":
      return "/trends/leaderboard";
    case "personalize":
      return `/personalize${buildQuery({ step: route.step })}`;
    case "schedule":
      return "/schedule";
    case "graph":
      return `/graph${buildQuery({ prof: route.professor })}`;
    case "donate":
      return "/donate";
    case "changelog":
      return "/changelog";
  }
}
