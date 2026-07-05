import type { ProfessorRegistry } from "@uoplan/core";
import { tr } from "../../i18n";
import { parseCoursePathParam } from "../explore/courseSearchParams";
import { resolveProfessorRoute } from "../explore/professorRoute";

/**
 * Clean, human label for the page a given URL points to, used for back buttons,
 * footer links, and anywhere else that names a navigation target. Matches on the
 * top-level section and can refine by query (e.g. an Explore search shows the
 * query it returns to) or by path (an Explore course detail shows its code), so
 * every affordance names its destination consistently from the URL alone.
 *
 * Professor detail pages encode only a slug/legacyId, which can't be turned into
 * a display name by string-munging alone, so pass the (already-loaded) professor
 * `registry` to resolve the canonical name; without it the label falls back to
 * the generic Explore section name.
 */
export function locationLabel(
  pathname: string,
  search?: string,
  registry?: ProfessorRegistry | null,
): string {
  if (pathname.startsWith("/explore/course/")) {
    const param = pathname.slice("/explore/course/".length).split("/")[0];
    const code = parseCoursePathParam(param);
    if (code) return code;
  }
  if (pathname.startsWith("/explore/professor/")) {
    const param = pathname.slice("/explore/professor/".length).split("/")[0];
    const { entry } = resolveProfessorRoute(registry, param);
    if (entry) return entry.name;
  }
  if (pathname.startsWith("/explore")) {
    const q = search ? new URLSearchParams(search).get("q")?.trim() : null;
    return q ? tr("explore.backToSearch", { q }) : tr("explore.title");
  }
  if (pathname.startsWith("/personalize")) return tr("landing.personalize.title");
  if (pathname.startsWith("/schedule/graph")) return tr("planner.title");
  if (pathname.startsWith("/schedule")) return tr("landing.schedule.title");
  if (pathname.startsWith("/professor-graph")) return tr("graph.title");
  if (pathname.startsWith("/trends")) return tr("app.nav.backTrends");
  if (pathname.startsWith("/donate")) return tr("donate.title");
  if (pathname.startsWith("/changelog")) return tr("app.changelog.title");
  return tr("app.nav.backHome");
}
