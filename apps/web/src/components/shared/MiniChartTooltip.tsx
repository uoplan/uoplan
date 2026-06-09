import { Box } from "@mantine/core";

interface MiniChartTooltipPayload {
  value?: number | string;
  payload?: { fullTerm?: string };
}

/**
 * A compact chart tooltip: the hovered term and its value in a small chip,
 * instead of Mantine's default multi-line series popover. Paired with the
 * chart's vertical cursor line so it reads like a scrubber readout.
 */
export function MiniChartTooltip({
  payload,
  format,
}: {
  payload?: MiniChartTooltipPayload[];
  format: (value: number) => string;
}) {
  const point = payload?.[0];
  if (point?.value == null) return null;
  const num = typeof point.value === "number" ? point.value : Number(point.value);
  const term = point.payload?.fullTerm;
  return (
    <Box
      style={{
        background: "var(--app-surface)",
        border: "var(--app-border-width) solid var(--app-border)",
        borderRadius: "var(--app-radius-sm)",
        padding: "1px 6px",
        fontSize: 11,
        fontWeight: 600,
        color: "var(--app-text)",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {term ? `${term} · ` : ""}
      {format(num)}
    </Box>
  );
}
