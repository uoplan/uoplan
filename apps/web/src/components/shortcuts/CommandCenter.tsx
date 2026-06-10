import { useEffect } from "react";
import { Text } from "@mantine/core";
import {
  Spotlight,
  spotlight,
  type SpotlightActionGroupData,
  type SpotlightFilterFunction,
} from "@mantine/spotlight";
import { useNavigate } from "@tanstack/react-router";
import { APP_DESTINATIONS } from "../../lib/navigation/appDestinations";
import { useCommandCenterStore } from "../../store/commandCenterStore";
import { useTr, i18n, tr } from "../../i18n";

/** Lowercase, comma-joined keyword string for substring matching. */
function keywordText(keywords: string | string[] | undefined): string {
  if (Array.isArray(keywords)) return keywords.join(",").toLowerCase();
  return (keywords ?? "").toLowerCase();
}

/** Filter a single group's actions by label/description/keywords (substring). */
function filterGroup(group: SpotlightActionGroupData, query: string): SpotlightActionGroupData {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return group;
  const actions = group.actions.filter((action) => {
    const label = action.label?.toLowerCase() ?? "";
    const description = action.description?.toLowerCase() ?? "";
    return label.includes(q) || description.includes(q) || keywordText(action.keywords).includes(q);
  });
  return { ...group, actions };
}

/**
 * Global command center (Cmd/Ctrl+K) for quickly jumping between the app's
 * top-level pages. Mounted once in the root layout. The `mod + K` shortcut is
 * handled by Spotlight itself and is ignored while typing in form fields.
 */
export function CommandCenter() {
  useTr();
  const navigate = useNavigate();

  // Each open request (footer button or the pre-mount `mod + K` listener) bumps
  // `openSignal`; this effect opens the now-mounted Spotlight in response. The
  // initial render already has a non-zero signal from the activating request.
  const openSignal = useCommandCenterStore((s) => s.openSignal);
  useEffect(() => {
    if (openSignal > 0) spotlight.open();
  }, [openSignal]);

  const pagesGroup: SpotlightActionGroupData = {
    group: tr("app.commandCenter.group.pages"),
    actions: APP_DESTINATIONS.map((dest) => {
      const Icon = dest.icon;
      return {
        id: dest.id,
        label: tr(dest.labelId),
        description: tr(dest.descriptionId),
        keywords: [...dest.keywords, dest.id],
        leftSection: <Icon size={20} stroke={1.5} />,
        rightSection: (
          <Text size="xs" c="dimmed" ff="monospace">
            g {dest.navKey}
          </Text>
        ),
        onClick: () => {
          void navigate({ to: dest.to });
        },
      };
    }),
  };

  const filter: SpotlightFilterFunction = (query, data) =>
    data.map((item) => ("actions" in item ? filterGroup(item, query) : item));

  return (
    <Spotlight
      key={i18n.locale}
      actions={[pagesGroup]}
      filter={filter}
      shortcut="mod + K"
      nothingFound={tr("app.commandCenter.nothingFound")}
      highlightQuery
      scrollable
      searchProps={{
        placeholder: tr("app.commandCenter.placeholder"),
        "aria-label": tr("app.commandCenter.placeholder"),
      }}
    />
  );
}
