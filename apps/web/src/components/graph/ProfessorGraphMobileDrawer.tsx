import type { ProfessorGraphNode, ProfessorRatingsMap } from "@uoplan/core";
import { tr } from "../../i18n";
import type { ExploreOfferingFlat } from "../../lib/explore/gradesSearch";
import type { GraphNeighbor, NeighborSortMode } from "../../lib/graph/professorGraphDetails";
import { BottomDrawer } from "../shared/BottomDrawer";
import { ProfessorGraphNodeDetails } from "./ProfessorGraphNodeDetails";

type ProfessorGraphMobileDrawerProps = {
  node: ProfessorGraphNode | null;
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

export function ProfessorGraphMobileDrawer({
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
}: ProfessorGraphMobileDrawerProps) {
  return (
    <BottomDrawer
      opened={node != null}
      onClose={onClose}
      title={node?.displayName}
      ariaLabel={tr("graph.nodeDetails")}
      maxHeight="70vh"
    >
      {node ? (
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
      ) : null}
    </BottomDrawer>
  );
}
