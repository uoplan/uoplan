import type { ComponentType, SVGProps } from "react";
import {
  IconAffiliate,
  IconCalendar,
  IconChartHistogram,
  IconCompass,
  IconHistory,
  IconHome2,
  IconListCheck,
} from "@tabler/icons-react";

/** Tabler-style icon component (accepts `size`/`stroke` alongside SVG props). */
type IconComponent = ComponentType<
  Omit<SVGProps<SVGSVGElement>, "stroke"> & { size?: number | string; stroke?: number | string }
>;

/**
 * A navigable top-level page of the app. Single source of truth shared by the
 * command center (Cmd/Ctrl+K), the global quick-nav hotkeys (`g` + key) and the
 * keyboard-shortcuts help overlay so the three never drift apart.
 */
type AppDestination = {
  /** Stable id (also the Spotlight action id). */
  id: string;
  /** Router path to navigate to. */
  to: string;
  /** tr() id for the human label. */
  labelId: string;
  /** tr() id for the short description. */
  descriptionId: string;
  /** Tabler icon component. */
  icon: IconComponent;
  /** Extra search terms for the command center, in English. */
  keywords: string[];
  /** Single letter pressed after the `g` leader to jump here (must be unique). */
  navKey: string;
};

/** Ordered list of command-center / quick-nav destinations. */
export const APP_DESTINATIONS: readonly AppDestination[] = [
  {
    id: "home",
    to: "/",
    labelId: "app.nav.dest.home.label",
    descriptionId: "app.nav.dest.home.description",
    icon: IconHome2,
    keywords: ["home", "start", "landing"],
    navKey: "h",
  },
  {
    id: "explore",
    to: "/explore",
    labelId: "app.nav.dest.explore.label",
    descriptionId: "app.nav.dest.explore.description",
    icon: IconCompass,
    keywords: ["explore", "search", "courses", "professors", "grades"],
    navKey: "e",
  },
  {
    id: "personalize",
    to: "/personalize",
    labelId: "app.nav.dest.personalize.label",
    descriptionId: "app.nav.dest.personalize.description",
    icon: IconListCheck,
    keywords: [
      "personalize",
      "profile",
      "program",
      "requirements",
      "completed",
      "planner",
      "wizard",
    ],
    navKey: "p",
  },
  {
    id: "schedule",
    to: "/schedule",
    labelId: "app.nav.dest.schedule.label",
    descriptionId: "app.nav.dest.schedule.description",
    icon: IconCalendar,
    keywords: ["schedule", "calendar", "timetable", "generate", "week"],
    navKey: "s",
  },
  {
    id: "trends",
    to: "/trends",
    labelId: "app.nav.dest.trends.label",
    descriptionId: "app.nav.dest.trends.description",
    icon: IconChartHistogram,
    keywords: ["trends", "grades", "history", "statistics"],
    navKey: "t",
  },
  {
    id: "graph",
    to: "/graph",
    labelId: "app.nav.dest.graph.label",
    descriptionId: "app.nav.dest.graph.description",
    icon: IconAffiliate,
    keywords: ["graph", "professors", "network", "connections"],
    navKey: "g",
  },
  {
    id: "changelog",
    to: "/changelog",
    labelId: "app.nav.dest.changelog.label",
    descriptionId: "app.nav.dest.changelog.description",
    icon: IconHistory,
    keywords: ["changelog", "updates", "releases", "news"],
    navKey: "l",
  },
] as const;

/**
 * Resolve the destination for a `g`-leader key press, or `null` when no
 * destination uses that key. Pure so it can be unit-tested without the DOM.
 */
export function destinationForNavKey(key: string): AppDestination | null {
  const normalized = key.toLowerCase();
  return APP_DESTINATIONS.find((d) => d.navKey === normalized) ?? null;
}
