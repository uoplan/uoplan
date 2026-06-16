import type { ReactNode } from "react";
import { Box, Stack, Text } from "@mantine/core";
import type { GradeVizData } from "@uoplan/core";
import { gpaToLetterGrade, gradeVizGpa } from "@uoplan/core";
import { tr, useTr } from "../../i18n";

export function SearchResultCardBody({ children }: { children: ReactNode }) {
  return (
    <Stack gap={5} p={12} style={{ flex: 1 }}>
      {children}
    </Stack>
  );
}

export function SearchResultCardSpacer() {
  return <Box style={{ flex: 1 }} />;
}

export function SearchResultGradeSummary({
  gradeViz,
  fallback = null,
}: {
  gradeViz: GradeVizData | null;
  fallback?: ReactNode;
}) {
  useTr();
  const grade = gradeViz ? gpaToLetterGrade(gradeVizGpa(gradeViz)) : null;
  const passing = gradeViz ? Math.round(gradeViz.passingPercent) : null;

  if (!gradeViz) return <>{fallback}</>;

  return (
    <Text size="xs" c="var(--app-text-muted)" lh={1.3}>
      {grade ? (
        <>
          <Text component="span" fw={600} c="var(--app-text)">
            {grade}
          </Text>{" "}
          ·{" "}
        </>
      ) : null}
      {passing !== null ? tr("search.passingPercent", { percent: passing }) : null}
    </Text>
  );
}
