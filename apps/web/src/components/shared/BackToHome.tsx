import { Link } from "@tanstack/react-router";
import { Anchor, Group, Text } from "@mantine/core";
import { IconChevronLeft } from "@tabler/icons-react";
import { useLingui } from "@lingui/react";
import { tr } from "../../i18n";

export function BackToHome() {
  useLingui();

  return (
    <Anchor component={Link} to="/" c="dimmed" underline="never">
      <Group gap={2} wrap="nowrap">
        <IconChevronLeft size={15} stroke={1.8} />
        <Text size="sm">{tr("app.nav.backHome")}</Text>
      </Group>
    </Anchor>
  );
}
