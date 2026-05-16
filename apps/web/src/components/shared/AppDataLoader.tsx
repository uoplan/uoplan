import { Box, Progress, Stack, Text } from "@mantine/core";
import { useLingui } from "@lingui/react";
import { tr } from "../../i18n";

export function AppDataLoader({ progress }: { progress: number }) {
  useLingui();
  const clamped = Math.min(100, Math.max(0, progress));

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        padding: "60px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Stack align="center" justify="center" gap="md" maw={360} w="100%">
        <Text size="sm" c="dimmed" ta="center">
          {tr("app.loadingData")}
        </Text>
        <Progress
          value={clamped}
          size="sm"
          radius={0}
          color="violet"
          w="100%"
          aria-label={tr("app.loadingData")}
          styles={{
            root: { backgroundColor: "#2C2E33" },
          }}
        />
        <Text size="xs" c="dimmed" ff="monospace">
          {clamped}%
        </Text>
      </Stack>
    </Box>
  );
}
