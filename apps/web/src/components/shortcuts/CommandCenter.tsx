import { Text } from "@mantine/core";
import { Spotlight, type SpotlightActionGroupData } from "@mantine/spotlight";
import { useNavigate } from "@tanstack/react-router";
import { APP_DESTINATIONS } from "../../lib/navigation/appDestinations";
import { useTr, i18n, tr } from "../../i18n";

/**
 * Global command center (Cmd/Ctrl+K) for quickly jumping between the app's
 * top-level pages. Mounted once in the root layout. The `mod + K` shortcut is
 * handled by Spotlight itself and is ignored while typing in form fields.
 */
export function CommandCenter() {
  useTr();
  const navigate = useNavigate();

  const groups: SpotlightActionGroupData[] = [
    {
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
    },
  ];

  return (
    <Spotlight
      key={i18n.locale}
      actions={groups}
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
