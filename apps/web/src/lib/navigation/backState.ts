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

/**
 * Clean, human label for the page a given URL points to, used for back buttons,
 * footer links, and anywhere else that names a navigation target. Matches on the
 * top-level section and can refine by query (e.g. an Explore search shows the
 * query it returns to), so every affordance names its destination consistently.
 */
export function locationLabel(pathname: string, search?: string): string {
  if (pathname.startsWith("/explore")) {
    const q = search ? new URLSearchParams(search).get("q")?.trim() : null;
    return q ? tr("explore.backToSearch", { q }) : tr("explore.title");
  }
  if (pathname.startsWith("/personalize")) return tr("landing.personalize.title");
  if (pathname.startsWith("/schedule")) return tr("landing.schedule.title");
  if (pathname.startsWith("/graph")) return tr("graph.title");
  if (pathname.startsWith("/trends")) return tr("app.nav.backTrends");
  if (pathname.startsWith("/donate")) return tr("donate.title");
  if (pathname.startsWith("/changelog")) return tr("app.changelog.title");
  return tr("app.nav.backHome");
}
