import { createFileRoute } from "@tanstack/react-router";
import { AppDataRouteGate } from "../components/shared/AppDataRouteGate";
import { TrendsPage } from "../components/trends/TrendsPage";
import { buildPageHead } from "../lib/seo";

export type TrendsSeason = "fall" | "winter" | "springSummer";
export type TrendsMetric = "gpa" | "a-plus" | "a-range" | "pass" | "volume";
export type TrendsSort = "rise" | "easiest" | "hardest";

export type TrendsSearch = {
  discipline?: string;
  level?: number;
  season?: TrendsSeason;
  metric?: TrendsMetric;
  sort?: TrendsSort;
  program?: string;
};

const VALID_LEVELS = new Set([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000]);

// URL values are kebab-case; internal values stay camelCase for type ergonomics.
const SEASON_TO_URL: Record<TrendsSeason, string> = {
  fall: "fall",
  winter: "winter",
  springSummer: "spring-summer",
};
const URL_TO_SEASON: Record<string, TrendsSeason> = {
  fall: "fall",
  winter: "winter",
  "spring-summer": "springSummer",
};

const VALID_METRICS: ReadonlySet<TrendsMetric> = new Set<TrendsMetric>([
  "gpa",
  "a-plus",
  "a-range",
  "pass",
  "volume",
]);

const VALID_SORTS: ReadonlySet<TrendsSort> = new Set<TrendsSort>(["rise", "easiest", "hardest"]);

/** Convert internal search state into the kebab-case object serialized to the URL. */
function toUrlSearch(search: TrendsSearch): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (search.discipline) out.discipline = search.discipline;
  if (search.level != null) out.level = search.level;
  if (search.season) out.season = SEASON_TO_URL[search.season];
  if (search.metric) out.metric = search.metric;
  if (search.sort) out.sort = search.sort;
  if (search.program) out.program = search.program;
  return out;
}

export const Route = createFileRoute("/trends")({
  head: () => buildPageHead("trends"),
  validateSearch: (search: Record<string, unknown>): TrendsSearch => {
    const out: TrendsSearch = {};
    if (typeof search.discipline === "string" && search.discipline.trim().length > 0) {
      out.discipline = search.discipline.trim().toUpperCase();
    }
    const level = Number(search.level);
    if (Number.isFinite(level) && VALID_LEVELS.has(level)) {
      out.level = level;
    }
    if (typeof search.season === "string" && URL_TO_SEASON[search.season]) {
      out.season = URL_TO_SEASON[search.season];
    }
    if (typeof search.metric === "string" && VALID_METRICS.has(search.metric as TrendsMetric)) {
      out.metric = search.metric as TrendsMetric;
    }
    if (typeof search.sort === "string" && VALID_SORTS.has(search.sort as TrendsSort)) {
      out.sort = search.sort as TrendsSort;
    }
    if (typeof search.program === "string" && search.program.trim().length > 0) {
      out.program = search.program.trim();
    }
    return out;
  },
  component: TrendsRoute,
});

function TrendsRoute() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();

  return (
    <AppDataRouteGate>
      <TrendsPage
        search={search}
        onChange={(next) =>
          navigate({ search: toUrlSearch(next), replace: true, resetScroll: false })
        }
      />
    </AppDataRouteGate>
  );
}
