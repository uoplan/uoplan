import { Button, Paper, Stack, Text } from "@mantine/core";
import { IconRoute, IconSchool } from "@tabler/icons-react";
import { tr, useTr } from "../../i18n";

export function PlannerEmptyState({
  hasProgram,
  onPersonalize,
}: {
  hasProgram: boolean;
  onPersonalize: () => void;
}) {
  useTr();
  return (
    <Paper withBorder radius="lg" p="xl" style={{ display: "grid", placeItems: "center", flex: 1 }}>
      <Stack align="center" gap="sm" maw={420} ta="center">
        <IconRoute size={40} stroke={1.5} />
        <Text fz="lg" fw={700}>
          {tr("planner.empty.title")}
        </Text>
        <Text fz="sm" c="dimmed">
          {hasProgram ? tr("planner.empty.bodyProgram") : tr("planner.empty.body")}
        </Text>
        <Button variant="light" leftSection={<IconSchool size={16} />} onClick={onPersonalize}>
          {tr("planner.empty.cta")}
        </Button>
      </Stack>
    </Paper>
  );
}
