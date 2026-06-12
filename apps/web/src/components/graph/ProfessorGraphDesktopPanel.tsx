import { ActionIcon, Box, ScrollArea, Stack } from "@mantine/core";
import { IconX } from "@tabler/icons-react";
import type { ProfessorGraphNode, ProfessorRatingsMap } from "@uoplan/core";
import { tr } from "../../i18n";
import type { ExploreOfferingFlat } from "../../lib/explore/gradesSearch";
import type { GraphNeighbor, NeighborSortMode } from "../../lib/graph/professorGraphDetails";
import { ProfessorGraphNodeDetails } from "./ProfessorGraphNodeDetails";

type ProfessorGraphDesktopPanelProps = {
  node: ProfessorGraphNode;
  offerings: ExploreOfferingFlat[];
  neighbors: GraphNeighbor[];
  neighborSort: NeighborSortMode;
  onNeighborSortChange: (mode: NeighborSortMode) => void;
  offeringsByProfessorId: Map<string, ExploreOfferingFlat[]>;
  professorRatings: ProfessorRatingsMap | null;
  professorSentiment: Map<string, number> | null;
  onSelectNode: (node: ProfessorGraphNode) => void;
  onClose: () => void;
};

export function ProfessorGraphDesktopPanel({
  node,
  offerings,
  neighbors,
  neighborSort,
  onNeighborSortChange,
  offeringsByProfessorId,
  professorRatings,
  professorSentiment,
  onSelectNode,
  onClose,
}: ProfessorGraphDesktopPanelProps) {
  return (
    <Box
      component="aside"
      aria-label={tr("graph.nodeDetails")}
      style={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 380,
        height: "100%",
        zIndex: 20,
        pointerEvents: "auto",
        backgroundColor: "color-mix(in srgb, var(--app-surface) 96%, transparent)",
        borderLeft: "1px solid var(--app-border)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Stack gap={0} style={{ flex: 1, minHeight: 0 }}>
        <Box
          style={{
            display: "flex",
            justifyContent: "flex-end",
            padding: "12px 12px 0",
            flexShrink: 0,
          }}
        >
          <ActionIcon
            variant="subtle"
            color="gray"
            size="md"
            onClick={onClose}
            aria-label={tr("graph.close")}
          >
            <IconX size={18} />
          </ActionIcon>
        </Box>
        <ScrollArea style={{ flex: 1 }} type="auto" offsetScrollbars px="md" pb="md">
          <ProfessorGraphNodeDetails
            node={node}
            offerings={offerings}
            neighbors={neighbors}
            neighborSort={neighborSort}
            onNeighborSortChange={onNeighborSortChange}
            offeringsByProfessorId={offeringsByProfessorId}
            professorRatings={professorRatings}
            professorSentiment={professorSentiment}
            onSelectNode={onSelectNode}
            showNeighbors
          />
        </ScrollArea>
      </Stack>
    </Box>
  );
}
