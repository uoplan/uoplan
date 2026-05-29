import { tr } from "../../i18n";

/**
 * Describes where a "back" affordance should return to and how to label it.
 * Attached to router location `state` by forward navigations so the destination
 * page can render an accurate back button and pop browser history.
 */
export type BackState = {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, unknown>;
  label: string;
};

/** Human label for a known top-level route, used for fallbacks and footer links. */
export function labelForPath(pathname: string): string {
  if (pathname.startsWith("/explore")) return tr("explore.title");
  if (pathname.startsWith("/schedule")) return tr("landing.schedule.title");
  if (pathname.startsWith("/graph")) return tr("graph.title");
  if (pathname.startsWith("/changelog")) return tr("app.changelog.title");
  return tr("app.nav.backHome");
}
