import type { ProfessorGraphNode } from "@uoplan/core";
import { tr } from "../../i18n";
import type { ProfessorGraphDetailsData } from "../../lib/graph/professorGraphDetails";
import { BottomDrawer } from "../shared/BottomDrawer";
import { ProfessorGraphNodeDetails } from "./ProfessorGraphNodeDetails";

type ProfessorGraphMobileDrawerProps = ProfessorGraphDetailsData & {
  node: ProfessorGraphNode | null;
  onClose: () => void;
};

export function ProfessorGraphMobileDrawer({
  node,
  onClose,
  ...details
}: ProfessorGraphMobileDrawerProps) {
  return (
    <BottomDrawer
      opened={node != null}
      onClose={onClose}
      title={node?.displayName}
      ariaLabel={tr("graph.nodeDetails")}
      maxHeight="70vh"
    >
      {node ? <ProfessorGraphNodeDetails node={node} {...details} showNeighbors /> : null}
    </BottomDrawer>
  );
}
