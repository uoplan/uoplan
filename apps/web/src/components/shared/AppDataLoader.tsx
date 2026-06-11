import { useEffect, useState } from "react";
import { Box, Progress, Stack, Text } from "@mantine/core";
import { tr, useTr } from "../../i18n";

type AppDataLoaderMode = "data" | "generating";

/**
 * Synthetic progress tuning for the generation phase. Generation is a single
 * blocking worker call with no progress events, so we fake a bar that fills and
 * decelerates toward {@link GENERATING_CEILING} as it approaches the 10s
 * generation timeout. The exponential approach naturally slows as it progresses.
 */
const GENERATING_TAU_MS = 3500;
const GENERATING_CEILING = 95;
const GENERATING_TICK_MS = 100;

function useSyntheticGenerationProgress(active: boolean): number {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) {
      setValue(0);
      return;
    }
    const start = performance.now();
    const id = setInterval(() => {
      const elapsed = performance.now() - start;
      const next = Math.round(GENERATING_CEILING * (1 - Math.exp(-elapsed / GENERATING_TAU_MS)));
      setValue((prev) => (prev === next ? prev : next));
    }, GENERATING_TICK_MS);
    return () => clearInterval(id);
  }, [active]);

  return value;
}

export function AppDataLoader({
  progress,
  mode = "data",
}: {
  progress: number;
  mode?: AppDataLoaderMode;
}) {
  useTr();
  const isGenerating = mode === "generating";
  const syntheticProgress = useSyntheticGenerationProgress(isGenerating);
  const clamped = Math.min(100, Math.max(0, isGenerating ? syntheticProgress : progress));
  const label = isGenerating ? tr("app.generatingSchedule") : tr("app.loadingData");

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
          {label}
        </Text>
        <Progress
          value={clamped}
          size="sm"
          radius="xl"
          color="accentBlue"
          w="100%"
          aria-label={label}
          styles={{
            root: { backgroundColor: "var(--app-border)" },
          }}
        />
        <Text size="xs" c="dimmed" ff="monospace">
          {clamped}%
        </Text>
      </Stack>
    </Box>
  );
}
