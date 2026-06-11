import { LineChart } from "@mantine/charts";
import { tr, useTr } from "../../../i18n";
import { MiniChartTooltip } from "../../shared/MiniChartTooltip";
import {
  FEEDBACK_RATE_COLOR,
  type FeedbackRatePoint,
  feedbackRateChartData,
  formatFeedbackRate,
} from "./feedbackChartData";

export function FeedbackAverageTooltip({
  payload,
}: {
  payload?: Array<{ value?: number | string }>;
}) {
  return <MiniChartTooltip payload={payload as never} format={(v) => v.toFixed(2)} />;
}

function FeedbackRateTooltip({ payload }: { payload?: Array<{ value?: number | string }> }) {
  return (
    <MiniChartTooltip payload={payload as never} format={(v) => `${String(Math.round(v))}%`} />
  );
}

export function FeedbackRateLineChart({
  height,
  points,
  withDots,
  withTooltip = false,
}: {
  height: number;
  points: readonly FeedbackRatePoint[];
  withDots: boolean;
  withTooltip?: boolean;
}) {
  useTr();

  return (
    <LineChart
      h={height}
      data={feedbackRateChartData(points)}
      dataKey="term"
      series={[
        {
          name: "rate",
          label: tr("explore.feedback.stat.responseRate"),
          color: FEEDBACK_RATE_COLOR,
        },
      ]}
      curveType="monotone"
      connectNulls
      withDots={withDots}
      yAxisProps={{ domain: [0, 100] }}
      valueFormatter={formatFeedbackRate}
      tooltipProps={
        withTooltip
          ? {
              content: ({ payload }) => <FeedbackRateTooltip payload={payload as never} />,
            }
          : undefined
      }
    />
  );
}
