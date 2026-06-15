import { Box, Stack, Text } from "@mantine/core";
import type { CSSProperties, ReactNode } from "react";
import type { GradeVizData } from "@uoplan/core";
import { GradeDistributionBottomBar } from "../calendar/GradeDistributionViz";
import { RatingBadge } from "../shared/RatingBadge";

const LINE_CLAMP_3_STYLE: CSSProperties = {
  display: "-webkit-box",
  WebkitLineClamp: 3,
  WebkitBoxOrient: "vertical",
  overflow: "hidden",
};

type Props = {
  /** Primary label (e.g. discipline code or faculty name); clamped when `clampTitle`. */
  title: ReactNode;
  clampTitle?: boolean;
  /** Optional secondary line, always clamped to 3 lines. */
  subtitle?: ReactNode;
  sentiment?: number | null;
  footer: ReactNode;
  gradeViz?: GradeVizData | null;
};

/**
 * Shared inner body for the discipline/faculty Explore search-result cards. The
 * route-typed `<Link>` chrome stays in each card; everything below it (title,
 * optional clamped subtitle, sentiment badge, footer, grade bar) lives here.
 */
export function SearchResultCardBody({
  title,
  clampTitle = false,
  subtitle,
  sentiment,
  footer,
  gradeViz,
}: Props) {
  return (
    <>
      <Stack gap={5} p={12} style={{ flex: 1 }}>
        <Text
          size="sm"
          fw={700}
          c="var(--app-text)"
          lh={1.3}
          style={clampTitle ? LINE_CLAMP_3_STYLE : undefined}
        >
          {title}
        </Text>
        {subtitle != null ? (
          <Text size="xs" c="dimmed" lh={1.4} style={LINE_CLAMP_3_STYLE}>
            {subtitle}
          </Text>
        ) : null}
        <Box style={{ flex: 1 }} />
        {sentiment != null && sentiment > 0 ? (
          <RatingBadge kind="satisfaction" value={sentiment} />
        ) : null}
        <Text size="xs" c="dimmed" lh={1.3}>
          {footer}
        </Text>
      </Stack>
      <GradeDistributionBottomBar gradeViz={gradeViz} />
    </>
  );
}
