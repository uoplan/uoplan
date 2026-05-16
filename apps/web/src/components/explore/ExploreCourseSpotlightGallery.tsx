import { Box, Stack, Text, UnstyledButton } from "@mantine/core";
import { useMemo, type CSSProperties } from "react";
import { formatLocaleNumber, tr } from "../../i18n";
import type {
  CourseSpotlightStat,
  CourseSpotlightVariant,
  RankedSpotlightCourse,
} from "../../lib/explore/courseSpotlight";
import type { ExploreCourseSearchEntry } from "../../lib/explore/gradesSearch";
import styles from "./ExploreCourseSpotlightGallery.module.css";

export type SpotlightGalleryRow = {
  variant: CourseSpotlightVariant;
  courses: RankedSpotlightCourse[];
  durationSec: number;
  reverse?: boolean;
};

const PAGE_BG = "transparent";
const CARD_BORDER = "rgba(255, 255, 255, 0.03)";
const CARD_BORDER_HOVER = "rgba(255, 255, 255, 0.07)";

function formatSpotlightStat(stat: CourseSpotlightStat): string {
  switch (stat.kind) {
    case "gpa":
      return tr("explore.spotlight.avgGpa", {
        gpa: formatLocaleNumber(stat.value, {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }),
      });
    case "gradeCount":
      return tr("explore.spotlight.gradeCount", {
        count: formatLocaleNumber(Math.round(stat.value)),
      });
    case "failRate":
      return tr("explore.spotlight.failRate", {
        pct: formatLocaleNumber(Math.round(stat.value * 100)),
      });
    case "professorCount":
      return tr("explore.spotlight.professorCount", {
        count: formatLocaleNumber(Math.round(stat.value)),
      });
  }
}

function SpotlightCard({
  course,
  onSelect,
}: {
  course: RankedSpotlightCourse;
  onSelect: (entry: ExploreCourseSearchEntry) => void;
}) {
  const title = course.entry.courseTitle.trim();
  const statLabel = formatSpotlightStat(course.stat);

  return (
    <UnstyledButton
      onClick={() => onSelect(course.entry)}
      aria-label={`${course.entry.courseCode}${title ? `, ${title}` : ""}`}
      style={{ flex: "0 0 auto" }}
    >
      <Box
        p="sm"
        w={176}
        style={{
          borderRadius: 0,
          border: `1px solid ${CARD_BORDER}`,
          backgroundColor: PAGE_BG,
          transition: "border-color 140ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = CARD_BORDER_HOVER;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = CARD_BORDER;
        }}
      >
        <Stack gap={4}>
          <Text size="xs" fw={500} c="gray.5" lineClamp={1}>
            {course.entry.courseCode}
          </Text>
          {title.length > 0 ? (
            <Text fz={10} c="gray.6" lineClamp={2} lh={1.3} mih={22}>
              {title}
            </Text>
          ) : (
            <Box mih={22} />
          )}
          <Text size="xs" c="gray.6" lh={1.2}>
            {statLabel}
          </Text>
        </Stack>
      </Box>
    </UnstyledButton>
  );
}

function SpotlightMarqueeRow({
  row,
  prefersReducedMotion,
  onSelectCourse,
}: {
  row: SpotlightGalleryRow;
  prefersReducedMotion: boolean;
  onSelectCourse: (entry: ExploreCourseSearchEntry) => void;
}) {
  const trackItems = prefersReducedMotion ? row.courses : [...row.courses, ...row.courses];
  const trackClass = [
    prefersReducedMotion ? styles.trackReduced : styles.track,
    !prefersReducedMotion && row.reverse ? styles.trackReverse : "",
  ]
    .filter(Boolean)
    .join(" ");

  const rowStyle: CSSProperties | undefined = prefersReducedMotion
    ? undefined
    : { ["--spotlight-duration" as string]: `${row.durationSec}s` };

  return (
    <Box className={prefersReducedMotion ? styles.rowReduced : styles.row} style={rowStyle}>
      <Box className={trackClass}>
        {trackItems.map((course, idx) => (
          <SpotlightCard
            key={`${course.entry.normCode}-${idx}`}
            course={course}
            onSelect={onSelectCourse}
          />
        ))}
      </Box>
    </Box>
  );
}

export function ExploreCourseSpotlightGallery({
  rows,
  onSelectCourse,
}: {
  rows: SpotlightGalleryRow[];
  onSelectCourse: (entry: ExploreCourseSearchEntry) => void;
}) {
  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  if (rows.length === 0) return null;

  return (
    <Box
      component="section"
      aria-label={tr("explore.spotlight.gallery")}
      className={styles.gallery}
      pt={32}
      pb={8}
      style={{
        width: "100vw",
        maxWidth: "100vw",
        marginInline: "calc(50% - 50vw)",
      }}
    >
      <Stack gap={10}>
        {rows.map((row) => (
          <SpotlightMarqueeRow
            key={row.variant}
            row={row}
            prefersReducedMotion={prefersReducedMotion}
            onSelectCourse={onSelectCourse}
          />
        ))}
      </Stack>
    </Box>
  );
}
