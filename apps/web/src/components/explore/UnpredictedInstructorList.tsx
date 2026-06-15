import { Link } from "@tanstack/react-router";
import { Fragment } from "react";
import type { MouseEvent } from "react";
import { Box, Stack, Text } from "@mantine/core";
import type { ProfessorRegistry, UnpredictedInstructor } from "@uoplan/core";
import { tr } from "../../i18n";
import {
  EMPTY_EXPLORE_SEARCH,
  professorLinkParam,
  REASON_ORDER,
  reasonDetailTitle,
  reasonGroupLabel,
  reasonInlineDetail,
  unpredictedKey,
} from "../../lib/explore/whyNotPredicted";

/**
 * Shared "why aren't these professors predicted?" list. Excluded historical
 * instructors are grouped under a single heading per reason (time conflict, not
 * teaching this term, stale, ranked lower), with the names rendered inline as
 * links so a course with many same-reason candidates stays compact. The specific
 * qualifier (the clashing class, the last year taught) is shown as a short inline
 * note plus a fuller hover title. Used by both the course-schedule section popover
 * and the course-page predicted-badge HoverCard; `onLinkClick` lets the popover
 * stop clicks from bubbling into the underlying selectable section card.
 */
export function UnpredictedInstructorList({
  items,
  registry,
  onLinkClick,
}: {
  items: UnpredictedInstructor[];
  registry: ProfessorRegistry | null;
  onLinkClick?: (e: MouseEvent) => void;
}) {
  return (
    <Stack gap={6}>
      <Text size="xs" fw={700} c="var(--app-text)">
        {tr("explore.schedule.whyNot.title")}
      </Text>
      {REASON_ORDER.map((kind) => {
        const group = items.filter((p) => p.reason.kind === kind);
        if (group.length === 0) return null;
        return (
          <Box key={kind}>
            <Text size="xs" c="var(--app-text-muted)" lh={1.3}>
              {reasonGroupLabel(kind)}
            </Text>
            <Text size="xs" lh={1.4} c="var(--app-text)">
              {group.map((prof, idx) => {
                const detail = reasonInlineDetail(prof.reason);
                return (
                  <Fragment key={unpredictedKey(prof)}>
                    {idx > 0 ? ", " : ""}
                    <Link
                      to="/explore/professor/$slug"
                      params={{ slug: professorLinkParam(registry, prof) }}
                      search={EMPTY_EXPLORE_SEARCH}
                      onClick={onLinkClick}
                      title={reasonDetailTitle(prof.reason)}
                      style={{
                        color: "var(--app-accent)",
                        fontWeight: 600,
                        textDecoration: "none",
                      }}
                    >
                      {prof.name}
                    </Link>
                    {detail ? (
                      <Text span size="xs" c="var(--app-text-muted)">
                        {" "}
                        ({detail})
                      </Text>
                    ) : null}
                  </Fragment>
                );
              })}
            </Text>
          </Box>
        );
      })}
    </Stack>
  );
}
