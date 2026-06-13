/**
 * Shared prop contract for the Icon primitive. Screens reference a small,
 * curated set of SEMANTIC icon names (e.g. `"search"`, `"calendar"`) rather than
 * a platform icon library directly, so the same `<Icon name="search" />` resolves
 * to a `@tabler/icons-react` glyph on web and the matching SF Symbol on native.
 * This keeps the icon set consistent across platforms and avoids leaking either
 * library into the shared `@uoplan/app` screens.
 */
export type IconName =
  | "search"
  | "calendar"
  | "home"
  | "chart"
  | "heart"
  | "settings"
  | "user"
  | "book"
  | "close"
  | "check"
  | "chevronRight"
  | "chevronDown"
  | "chevronLeft"
  | "arrowLeft"
  | "plus"
  | "minus"
  | "info"
  | "alert"
  | "star"
  | "share"
  | "download"
  | "trash"
  | "edit"
  | "filter"
  | "clock"
  | "graph"
  | "school";

export interface IconProps {
  /** Semantic icon name (resolved per platform). */
  name: IconName;
  /** Glyph size in points/pixels. Defaults to 20. */
  size?: number;
  /** Tint colour (CSS/RN colour string). Defaults to `currentColor`/label. */
  color?: string;
  /** Accessible label. When omitted, the icon is treated as decorative. */
  label?: string;
  /** Test hook: maps to `data-testid` (web) / `testID` (native). */
  testID?: string;
}

/**
 * Curated semantic-name → SF Symbol name map, shared by the native adapter (and
 * exported so consumers/tests can introspect the supported set). Web maps the
 * same names onto `@tabler/icons-react` components in `Icon.web.tsx`.
 */
export const SF_SYMBOL_FOR_ICON: Record<IconName, string> = {
  search: "magnifyingglass",
  calendar: "calendar",
  home: "house",
  chart: "chart.bar",
  heart: "heart",
  settings: "gearshape",
  user: "person",
  book: "book",
  close: "xmark",
  check: "checkmark",
  chevronRight: "chevron.right",
  chevronDown: "chevron.down",
  chevronLeft: "chevron.left",
  arrowLeft: "arrow.left",
  plus: "plus",
  minus: "minus",
  info: "info.circle",
  alert: "exclamationmark.triangle",
  star: "star",
  share: "square.and.arrow.up",
  download: "arrow.down.circle",
  trash: "trash",
  edit: "pencil",
  filter: "line.3.horizontal.decrease",
  clock: "clock",
  graph: "point.3.connected.trianglepath.dotted",
  school: "graduationcap",
};
