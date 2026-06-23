import { useMemo } from "react";
import { ActionIcon, Group, Stack, Text } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { tr, useTr } from "../../../i18n";
import { GradeDistributionBottomBar } from "../../calendar/GradeDistributionViz";
import { RatingBadge } from "../../shared/RatingBadge";
import { courseNormToPathParam } from "../../../lib/explore/courseSearchParams";
import { EMPTY_EXPLORE_SEARCH } from "../../../lib/explore/exploreFilters";
import { formatTermLabel } from "../../../lib/term/termLabel";
import { CompareGrid } from "./CompareGrid";
import type { CompareColumn, CompareRow } from "./CompareGrid";
import { useCourseCompareData } from "./useCourseCompareData";
import type { CourseCompareDatum } from "./useCourseCompareData";

function NoneCell() {
  return (
    <Text span size="sm" c="var(--app-text-dimmed)">
      {tr("compare.value.none")}
    </Text>
  );
}

const LANGUAGE_LABEL_ID = {
  en: "constrainStep.languages.english",
  fr: "constrainStep.languages.french",
} as const;

/** Build the attribute rows for the course comparison grid. */
function buildRows(data: CourseCompareDatum[]): CompareRow[] {
  const cell = (render: (d: CourseCompareDatum) => ReactNode) => data.map(render);

  return [
    {
      key: "credits",
      label: tr("compare.row.credits"),
      cells: cell((d) => (d.credits != null ? <span>{d.credits}</span> : <NoneCell />)),
    },
    {
      key: "faculty",
      label: tr("compare.row.faculty"),
      cells: cell((d) => (d.facultyName ? <span>{d.facultyName}</span> : <NoneCell />)),
    },
    {
      key: "level",
      label: tr("compare.row.level"),
      cells: cell((d) =>
        d.level != null ? <span>{tr(`explore.filter.level.${d.level}`)}</span> : <NoneCell />,
      ),
    },
    {
      key: "language",
      label: tr("compare.row.language"),
      cells: cell((d) =>
        d.language ? <span>{tr(LANGUAGE_LABEL_ID[d.language])}</span> : <NoneCell />,
      ),
    },
    {
      key: "prereqs",
      label: tr("compare.row.prereqs"),
      cells: cell((d) =>
        d.prereqText ? (
          <Text span size="sm">
            {d.prereqText}
          </Text>
        ) : (
          <Text span size="sm" c="var(--app-text-dimmed)">
            {tr("compare.value.noPrereqs")}
          </Text>
        ),
      ),
    },
    {
      key: "terms",
      label: tr("compare.row.terms"),
      cells: cell((d) =>
        d.termIds.length > 0 ? (
          <span>{d.termIds.map((id) => formatTermLabel(id)).join(", ")}</span>
        ) : (
          <NoneCell />
        ),
      ),
    },
    {
      key: "grades",
      label: tr("compare.row.grades"),
      cells: cell((d) =>
        d.gradeViz ? (
          <div style={{ maxWidth: 220 }}>
            <GradeDistributionBottomBar gradeViz={d.gradeViz} />
          </div>
        ) : (
          <NoneCell />
        ),
      ),
    },
    {
      key: "avgGpa",
      label: tr("compare.row.avgGpa"),
      cells: cell((d) => (d.avgGpa != null ? <span>{d.avgGpa.toFixed(2)}</span> : <NoneCell />)),
    },
    {
      key: "passing",
      label: tr("compare.row.passing"),
      cells: cell((d) =>
        d.passingPercent != null ? <span>{Math.round(d.passingPercent)}%</span> : <NoneCell />,
      ),
    },
    {
      key: "topRating",
      label: tr("compare.row.topRating"),
      cells: cell((d) =>
        d.maxProfessorRating != null ? (
          <RatingBadge kind="rmp" value={d.maxProfessorRating} />
        ) : (
          <NoneCell />
        ),
      ),
    },
    {
      key: "sentiment",
      label: tr("compare.row.sentiment"),
      cells: cell((d) =>
        d.sentiment != null && d.sentiment > 0 ? (
          <RatingBadge kind="satisfaction" value={d.sentiment} />
        ) : (
          <NoneCell />
        ),
      ),
    },
  ];
}

/** Course-resource comparison: columns = courses, rows = attributes. */
export function CourseCompareView({
  codes,
  onRemove,
}: {
  codes: string[];
  onRemove: (code: string) => void;
}) {
  useTr();
  const { data } = useCourseCompareData(codes);

  const columns = useMemo<CompareColumn[]>(
    () =>
      data.map((d) => ({
        key: d.norm,
        header: (
          <Stack gap={4}>
            <Group gap={6} justify="space-between" wrap="nowrap" align="flex-start">
              <Link
                to="/explore/course/$course"
                params={{ course: courseNormToPathParam(d.norm) }}
                search={EMPTY_EXPLORE_SEARCH}
                style={{
                  color: "var(--app-text)",
                  fontWeight: 700,
                  textDecoration: "none",
                }}
              >
                {d.code}
              </Link>
              <ActionIcon
                variant="subtle"
                color="gray"
                size="sm"
                radius="md"
                aria-label={tr("compare.remove.aria", { name: d.code })}
                title={tr("compare.remove.aria", { name: d.code })}
                onClick={() => onRemove(d.code)}
              >
                <IconX size={15} stroke={1.8} aria-hidden="true" />
              </ActionIcon>
            </Group>
            {d.title ? (
              <Text
                size="xs"
                c="dimmed"
                lh={1.35}
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
              >
                {d.title}
              </Text>
            ) : null}
          </Stack>
        ),
      })),
    [data, onRemove],
  );

  const rows = useMemo(() => buildRows(data), [data]);

  return <CompareGrid columns={columns} rows={rows} />;
}
