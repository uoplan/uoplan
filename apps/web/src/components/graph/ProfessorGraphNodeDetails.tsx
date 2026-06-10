import { Link } from "@tanstack/react-router";
import { Badge, Box, Group, SegmentedControl, Stack, Text, UnstyledButton } from "@mantine/core";
import { IconExternalLink } from "@tabler/icons-react";
import { useMemo, type CSSProperties } from "react";
import type { ProfessorGraphNode, ProfessorRatingsMap } from "@uoplan/core";
import { normalizeProfessorName, hasProfessorRatings } from "@uoplan/core";
import { tr } from "../../i18n";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import {
  GradeDistributionHistogram,
  GradeDistributionPassingSummary,
} from "../calendar/GradeDistributionViz";
import {
  getAggregateGradeViz,
  sortGraphNeighbors,
  type GraphNeighbor,
  type NeighborSortMode,
} from "../../lib/graph/professorGraphDetails";
import type { ExploreOfferingFlat } from "../../lib/explore/gradesSearch";

const HISTOGRAM_ROW_WIDTH_PX = 88;
const PROFILE_LINK_STYLE: CSSProperties = {
  color: "var(--app-text)",
  textDecoration: "none",
  flexShrink: 0,
  display: "inline-flex",
  alignItems: "center",
};

function sortedDisciplines(disciplineWeights: Readonly<Record<string, number>>): string[] {
  return Object.entries(disciplineWeights)
    .filter(([, weight]) => weight > 0)
    .sort(([a, wa], [b, wb]) => wb - wa || a.localeCompare(b, "en"))
    .map(([code]) => code);
}

function ProfessorProfileLink({
  legacyId,
  onClick,
}: {
  legacyId: number;
  onClick?: React.MouseEventHandler<HTMLAnchorElement>;
}) {
  return (
    <Link
      to="/explore/professor/$slug"
      params={{ slug: String(legacyId) }}
      search={EMPTY_EXPLORE_SEARCH}
      onClick={onClick}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={tr("explore.profileLink")}
      title={tr("explore.profileLink")}
      style={PROFILE_LINK_STYLE}
    >
      <IconExternalLink size={15} stroke={1.8} />
    </Link>
  );
}

function DisciplineChip({ code }: { code: string }) {
  return (
    <Badge
      size="xs"
      variant="light"
      radius="sm"
      styles={{
        root: {
          textTransform: "none",
          backgroundColor: "var(--app-info-soft)",
          color: "var(--app-info)",
          border: "var(--app-border-width) solid var(--app-border)",
        },
      }}
    >
      {code}
    </Badge>
  );
}

function DisciplineChips({ disciplineWeights }: { disciplineWeights: Record<string, number> }) {
  const disciplines = useMemo(() => sortedDisciplines(disciplineWeights), [disciplineWeights]);
  if (disciplines.length === 0) return null;
  return (
    <Group gap={4} wrap="wrap" mt={4}>
      {disciplines.map((code) => (
        <DisciplineChip key={code} code={code} />
      ))}
    </Group>
  );
}

function histogramBoxStyle(widthPx: number): CSSProperties {
  return {
    flex: "0 0 auto",
    width: widthPx,
    maxWidth: widthPx,
    marginLeft: "auto",
  };
}

function professorRatingLine(displayName: string, professorRatings: ProfessorRatingsMap | null) {
  if (!professorRatings) return null;
  const entry = professorRatings[normalizeProfessorName(displayName)];
  if (!entry) return null;
  if (!hasProfessorRatings(entry)) {
    return (
      <Text size="xs" c="dimmed">
        {tr("search.noRating")}
      </Text>
    );
  }
  return (
    <Text size="xs" c="dimmed">
      {entry.rating.toFixed(1)} · {entry.numRatings} ratings
    </Text>
  );
}

function ProfessorGradeSection({ offerings }: { offerings: ExploreOfferingFlat[] }) {
  const gradeViz = useMemo(() => getAggregateGradeViz(offerings), [offerings]);

  if (!gradeViz) {
    return (
      <Text size="xs" c="dimmed">
        {tr("graph.noGradeData")}
      </Text>
    );
  }

  return (
    <Stack gap="xs" w="100%">
      <GradeDistributionPassingSummary gradeViz={gradeViz} compact />
      <GradeDistributionHistogram gradeViz={gradeViz} variant="compact" />
    </Stack>
  );
}

function NeighborRow({
  neighbor,
  offeringsByProfessorId,
  onSelect,
}: {
  neighbor: GraphNeighbor;
  offeringsByProfessorId: Map<string, ExploreOfferingFlat[]>;
  onSelect: (node: ProfessorGraphNode) => void;
}) {
  const neighborId = neighbor.node.id;
  const gradeViz = useMemo(
    () => getAggregateGradeViz(offeringsByProfessorId.get(neighborId) ?? []),
    [offeringsByProfessorId, neighborId],
  );

  return (
    <UnstyledButton
      onClick={() => onSelect(neighbor.node)}
      py="sm"
      px="xs"
      style={{
        borderRadius: "var(--app-radius-sm)",
        display: "block",
        width: "100%",
        borderTop: "var(--app-border-width) solid var(--app-border)",
      }}
    >
      <Group justify="space-between" align="center" wrap="nowrap" gap="sm" w="100%">
        <Stack gap={4} style={{ minWidth: 0, flex: "1 1 auto" }}>
          <Group gap="xs" align="center" wrap="nowrap">
            <Text size="sm" fw={600} c="var(--app-text)" lineClamp={1}>
              {neighbor.node.displayName}
            </Text>
            {neighbor.node.legacyId != null ? (
              <ProfessorProfileLink
                legacyId={neighbor.node.legacyId}
                onClick={(e) => e.stopPropagation()}
              />
            ) : null}
          </Group>
          <Text size="xs" c="dimmed">
            {tr("graph.sharedCourses", { weight: neighbor.weight })}
          </Text>
        </Stack>
        {gradeViz ? (
          <Box style={histogramBoxStyle(HISTOGRAM_ROW_WIDTH_PX)}>
            <GradeDistributionHistogram gradeViz={gradeViz} variant="compact" hideLabels />
          </Box>
        ) : null}
      </Group>
    </UnstyledButton>
  );
}

type ProfessorGraphNodeDetailsProps = {
  node: ProfessorGraphNode;
  offerings: ExploreOfferingFlat[];
  neighbors: GraphNeighbor[];
  neighborSort: NeighborSortMode;
  onNeighborSortChange: (mode: NeighborSortMode) => void;
  offeringsByProfessorId: Map<string, ExploreOfferingFlat[]>;
  professorRatings: ProfessorRatingsMap | null;
  onSelectNode: (node: ProfessorGraphNode) => void;
  showNeighbors: boolean;
};

export function ProfessorGraphNodeDetails({
  node,
  offerings,
  neighbors,
  neighborSort,
  onNeighborSortChange,
  offeringsByProfessorId,
  professorRatings,
  onSelectNode,
  showNeighbors,
}: ProfessorGraphNodeDetailsProps) {
  const sortedNeighbors = useMemo(
    () => sortGraphNeighbors(neighbors, neighborSort),
    [neighbors, neighborSort],
  );

  return (
    <Stack gap="md">
      <Stack gap={4}>
        <Group gap="xs" align="center" wrap="nowrap">
          <Text fw={600} c="var(--app-text)" size="lg" lineClamp={3} style={{ minWidth: 0 }}>
            {node.displayName}
          </Text>
          {node.legacyId != null ? <ProfessorProfileLink legacyId={node.legacyId} /> : null}
        </Group>
        {professorRatingLine(node.displayName, professorRatings)}
        <Text size="xs" c="dimmed">
          {tr("graph.connections", { count: node.degree })}
        </Text>
        {node.degree === 0 && (
          <Text size="xs" c="dimmed">
            {tr("graph.noConnections")}
          </Text>
        )}
        {node.subjects.length > 0 && <DisciplineChips disciplineWeights={node.disciplineWeights} />}
      </Stack>

      <ProfessorGradeSection offerings={offerings} />

      {showNeighbors && neighbors.length > 0 && (
        <Stack gap="sm">
          <Group justify="space-between" align="center" wrap="wrap" gap="xs">
            <Text size="sm" fw={600} c="var(--app-text)">
              {tr("graph.connectedProfessors")}
            </Text>
            <SegmentedControl
              size="xs"
              value={neighborSort}
              onChange={(v) => onNeighborSortChange(v as NeighborSortMode)}
              data={[
                { label: tr("graph.sortByStrength"), value: "strength" },
                { label: tr("graph.sortByName"), value: "name" },
              ]}
              styles={{
                root: { backgroundColor: "var(--app-surface-sunken)" },
                label: { color: "var(--app-text-muted)", fontSize: 11 },
              }}
            />
          </Group>
          <Stack gap={0}>
            {sortedNeighbors.map((neighbor) => (
              <NeighborRow
                key={neighbor.node.id}
                neighbor={neighbor}
                offeringsByProfessorId={offeringsByProfessorId}
                onSelect={onSelectNode}
              />
            ))}
          </Stack>
        </Stack>
      )}
    </Stack>
  );
}
