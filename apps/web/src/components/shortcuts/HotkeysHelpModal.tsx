import { Divider, Group, Kbd, Modal, Stack, Text } from "@mantine/core";
import { useOs } from "@mantine/hooks";
import { APP_DESTINATIONS } from "../../lib/navigation/appDestinations";
import { useHelpModalStore } from "../../store/uiHelpStore";
import { tr, useTr } from "../../i18n";

function ShortcutRow({ label, keys }: { label: string; keys: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md">
      <Text size="sm">{label}</Text>
      <Group gap={6} wrap="nowrap">
        {keys}
      </Group>
    </Group>
  );
}

/**
 * Help overlay listing every keyboard shortcut. Opened with `?` or the
 * discoverability button. Mounted once in the root layout.
 */
export function HotkeysHelpModal() {
  useTr();
  const isOpen = useHelpModalStore((s) => s.isOpen);
  const close = useHelpModalStore((s) => s.close);
  const os = useOs();
  const modLabel = os === "macos" ? "⌘" : "Ctrl";

  return (
    <Modal opened={isOpen} onClose={close} title={tr("app.shortcuts.title")} centered size="md">
      <Stack gap="lg">
        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {tr("app.shortcuts.group.global")}
          </Text>
          <ShortcutRow
            label={tr("app.shortcuts.commandCenter")}
            keys={
              <>
                <Kbd>{modLabel}</Kbd>
                <Text size="sm" c="dimmed">
                  +
                </Text>
                <Kbd>K</Kbd>
              </>
            }
          />
          <ShortcutRow label={tr("app.shortcuts.help")} keys={<Kbd>?</Kbd>} />
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {tr("app.shortcuts.group.quickNav")}
          </Text>
          <Text size="xs" c="dimmed">
            {tr("app.shortcuts.quickNav.hint")}
          </Text>
          {APP_DESTINATIONS.map((dest) => (
            <ShortcutRow
              key={dest.id}
              label={tr(dest.labelId)}
              keys={
                <>
                  <Kbd>G</Kbd>
                  <Text size="sm" c="dimmed">
                    {tr("app.shortcuts.then")}
                  </Text>
                  <Kbd>{dest.navKey.toUpperCase()}</Kbd>
                </>
              }
            />
          ))}
        </Stack>

        <Divider />

        <Stack gap="xs">
          <Text size="xs" fw={600} c="dimmed" tt="uppercase">
            {tr("app.shortcuts.group.calendar")}
          </Text>
          <ShortcutRow label={tr("app.shortcuts.prevSchedule")} keys={<Kbd>←</Kbd>} />
          <ShortcutRow label={tr("app.shortcuts.nextSchedule")} keys={<Kbd>→</Kbd>} />
        </Stack>
      </Stack>
    </Modal>
  );
}
