import { ActionIcon, Badge, Box, Group, Popover, Stack, Text, Tooltip } from "@mantine/core";
import { LineChart } from "@mantine/charts";
import { IconInfoCircle } from "@tabler/icons-react";
import { tr, useTr } from "../../../i18n";
import {
  FEEDBACK_SENTIMENT_COLOR,
  feedbackAverageChartData,
  formatFeedbackAverage,
} from "./feedbackChartData";
import { FeedbackAverageTooltip } from "./feedbackChartShared";

const QUESTION_CHART_HEIGHT = 200;
const CHART_PLOT_TOP = 5;
const CHART_PLOT_BOTTOM = 35;

interface FeedbackQuestionPoint {
  termId: number;
  average: number;
  responses: number;
}

interface FeedbackQuestionChartProps {
  questionText: string;
  points: readonly FeedbackQuestionPoint[];
  optionLabels: readonly string[];
  responsesTotal: number;
  showScaleLabels: boolean;
  color?: string;
  showQuestionHeader?: boolean;
  showResponsesBadge?: boolean;
  showOptionsPopover?: boolean;
}

/** Sentence-case a lowercase data label ("strongly agree" -> "Strongly agree"). */
function sentenceCase(label: string): string {
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/**
 * A vertical response scale that stands in for the chart's y-axis: every option
 * is placed at its score position (best at the top = 5, worst at the bottom = 1),
 * evenly spaced and aligned with the graph's plot area, with a success->danger
 * track. Rendered only when the option labels are known.
 */
function FeedbackScaleLegend({
  options,
  showLabels,
}: {
  options: readonly string[];
  showLabels: boolean;
}) {
  if (options.length < 2) return null;
  const last = options.length - 1;
  return (
    <Box
      style={{
        position: "relative",
        width: showLabels ? 150 : 24,
        height: QUESTION_CHART_HEIGHT,
        flex: "none",
      }}
    >
      {/* The scale track runs from the top of the chart down to roughly the bottom
          of the "1" (its centre sits on the plot baseline, so add half a line). */}
      <Box
        style={{
          position: "absolute",
          top: 0,
          bottom: CHART_PLOT_BOTTOM - 6,
          right: 0,
          width: 3,
          borderRadius: "var(--app-radius-pill)",
          background:
            "linear-gradient(180deg, var(--app-success), var(--app-warning), var(--app-danger))",
        }}
      />
      {/* The numbers/labels align with the plot area (where 5..1 are drawn). */}
      <Box
        style={{
          position: "absolute",
          top: CHART_PLOT_TOP,
          bottom: CHART_PLOT_BOTTOM,
          right: 0,
          left: 0,
        }}
      >
        {options.map((option, i) => {
          // Best-first: option 0 sits at the top (score 5), the last at the bottom
          // (score 1); the score is only labelled at the two endpoints (the axis).
          const score = i === 0 ? "5" : i === last ? "1" : "";
          return (
            <Group
              key={`${String(i)}-${option}`}
              gap={6}
              wrap="nowrap"
              align="center"
              justify="flex-end"
              style={{
                position: "absolute",
                right: 10,
                left: 0,
                top: `${String((i / last) * 100)}%`,
                transform: "translateY(-50%)",
              }}
            >
              {showLabels ? (
                <Tooltip
                  label={sentenceCase(option)}
                  withArrow
                  events={{ hover: true, focus: true, touch: true }}
                >
                  <Text size="xs" c="dimmed" truncate style={{ textAlign: "right" }}>
                    {sentenceCase(option)}
                  </Text>
                </Tooltip>
              ) : null}
              <Text
                size="xs"
                fw={700}
                c="var(--app-text)"
                style={{ width: 8, textAlign: "right", fontVariantNumeric: "tabular-nums" }}
              >
                {score}
              </Text>
            </Group>
          );
        })}
      </Box>
    </Box>
  );
}

/**
 * The score the large-screen `FeedbackScaleLegend` draws each option at: option 0
 * sits at the top (5) and the last at the bottom (1), evenly spaced. Integers render
 * plainly ("5"); anything in between gets a single decimal.
 */
function optionScore(index: number, total: number): string {
  const score = 5 - (index / (total - 1)) * 4;
  return Number.isInteger(score) ? String(score) : score.toFixed(1);
}

/**
 * A small info button (shown on narrow screens, where the legend's per-option labels
 * are hidden) that opens a popover listing each response option best->worst with its
 * score on the 1-5 scale — the same values the legend implies on wide screens.
 */
function QuestionOptionsPopover({ options }: { options: readonly string[] }) {
  useTr();
  if (options.length < 2) return null;
  return (
    <Popover width={240} position="bottom-end" withArrow shadow="md" radius="md">
      <Popover.Target>
        <ActionIcon
          variant="subtle"
          size="sm"
          radius="xl"
          color="gray"
          aria-label={tr("explore.feedback.scaleOptions")}
          style={{ flexShrink: 0 }}
        >
          <IconInfoCircle size={16} />
        </ActionIcon>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap={6}>
          <Text size="xs" c="dimmed" fw={600} style={{ letterSpacing: "0.02em" }}>
            {tr("explore.feedback.scaleOptions")}
          </Text>
          {options.map((option, i) => (
            <Group key={`${String(i)}-${option}`} gap="sm" wrap="nowrap" justify="space-between">
              <Text size="sm" c="var(--app-text)" style={{ lineHeight: 1.3 }}>
                {sentenceCase(option)}
              </Text>
              <Text
                size="sm"
                fw={700}
                c="var(--app-text)"
                style={{ flexShrink: 0, fontVariantNumeric: "tabular-nums" }}
              >
                {optionScore(i, options.length)}
              </Text>
            </Group>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}

export function FeedbackQuestionChart({
  questionText,
  points,
  optionLabels,
  responsesTotal,
  showScaleLabels,
  color = FEEDBACK_SENTIMENT_COLOR,
  showQuestionHeader = true,
  showResponsesBadge = true,
  showOptionsPopover = true,
}: FeedbackQuestionChartProps) {
  useTr();
  return (
    <>
      {showQuestionHeader ? (
        <Group gap="sm" mb={8} wrap="nowrap" align="flex-start" justify="space-between">
          <Group gap={6} wrap="nowrap" align="flex-start" style={{ minWidth: 0 }}>
            <Text fw={600} size="sm" style={{ lineHeight: 1.4 }}>
              {questionText}
            </Text>
            {showOptionsPopover && !showScaleLabels ? (
              <QuestionOptionsPopover options={optionLabels} />
            ) : null}
          </Group>
          {showResponsesBadge && showScaleLabels ? (
            <Badge variant="light" size="sm" radius="sm" style={{ flexShrink: 0 }}>
              {tr("explore.feedback.responsesCount", { count: responsesTotal })}
            </Badge>
          ) : null}
        </Group>
      ) : null}
      <Group gap="md" wrap="nowrap" align="center">
        <FeedbackScaleLegend options={optionLabels} showLabels={showScaleLabels} />
        <Box style={{ flex: "1 1 auto", minWidth: 0 }}>
          <LineChart
            h={QUESTION_CHART_HEIGHT}
            data={feedbackAverageChartData(points)}
            dataKey="term"
            series={[{ name: "average", label: tr("explore.feedback.stat.sentiment"), color }]}
            curveType="monotone"
            connectNulls
            withDots={showScaleLabels && points.length <= 24}
            withYAxis={false}
            yAxisProps={{ domain: [1, 5] }}
            valueFormatter={formatFeedbackAverage}
            tooltipProps={{
              content: ({ payload }) => <FeedbackAverageTooltip payload={payload as never} />,
            }}
          />
        </Box>
      </Group>
    </>
  );
}
