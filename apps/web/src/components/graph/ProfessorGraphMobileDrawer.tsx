import { Drawer, ScrollArea } from "@mantine/core";
import type { ProfessorGraphNode, ProfessorRatingsMap } from "@uoplan/schedule";
import { tr } from "../../i18n";
import type { ExploreOfferingFlat } from "../../lib/explore/gradesSearch";
import type { GraphNeighbor, NeighborSortMode } from "../../lib/graph/professorGraphDetails";
import { ProfessorGraphNodeDetails } from "./ProfessorGraphNodeDetails";

const SURFACE_STYLE = {
  backgroundColor: "rgba(26, 27, 30, 0.98)",
  borderTop: "1px solid rgba(134, 142, 150, 0.25)",
};

type ProfessorGraphMobileDrawerProps = {
  node: ProfessorGraphNode | null;
  offerings: ExploreOfferingFlat[];
  neighbors: GraphNeighbor[];
  neighborSort: NeighborSortMode;
  onNeighborSortChange: (mode: NeighborSortMode) => void;
  offeringsByProfessorId: Map<string, ExploreOfferingFlat[]>;
  professorRatings: ProfessorRatingsMap | null;
  onSelectNode: (node: ProfessorGraphNode) => void;
  onClose: () => void;
};

export function ProfessorGraphMobileDrawer({
  node,
  offerings,
  neighbors,
  neighborSort,
  onNeighborSortChange,
  offeringsByProfessorId,
  professorRatings,
  onSelectNode,
  onClose,
}: ProfessorGraphMobileDrawerProps) {
  return (
    <Drawer
      opened={node != null}
      onClose={onClose}
      position="bottom"
      size="auto"
      title={node?.displayName}
      overlayProps={{ backgroundOpacity: 0.45 }}
      styles={{
        content: { ...SURFACE_STYLE, maxHeight: "70vh" },
        header: {
          ...SURFACE_STYLE,
          borderBottom: "1px solid rgba(134, 142, 150, 0.2)",
        },
        title: { color: "#F8F9FA", fontWeight: 600 },
        close: { color: "#868e96" },
      }}
      aria-label={tr("graph.nodeDetails")}
    >
      {node ? (
        <ScrollArea.Autosize mah="calc(70vh - 60px)" type="auto" offsetScrollbars>
          <ProfessorGraphNodeDetails
            node={node}
            offerings={offerings}
            neighbors={neighbors}
            neighborSort={neighborSort}
            onNeighborSortChange={onNeighborSortChange}
            offeringsByProfessorId={offeringsByProfessorId}
            professorRatings={professorRatings}
            onSelectNode={onSelectNode}
            showNeighbors
          />
        </ScrollArea.Autosize>
      ) : null}
    </Drawer>
  );
}
