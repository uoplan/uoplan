import { useRef } from "react";
import { Drawer, ScrollArea } from "@mantine/core";
import type { ProfessorGraphNode, ProfessorRatingsMap } from "@uoplan/schedule";
import { tr } from "../../i18n";
import type { ExploreOfferingFlat } from "../../lib/explore/gradesSearch";
import type { GraphNeighbor, NeighborSortMode } from "../../lib/graph/professorGraphDetails";
import { ProfessorGraphNodeDetails } from "./ProfessorGraphNodeDetails";
import { useDragToDismiss } from "../../hooks/useDragToDismiss";

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
  const scrollRef = useRef<HTMLDivElement>(null);
  const opened = node != null;
  const { dragOffset, dragging, handlers } = useDragToDismiss({ opened, onClose, scrollRef });

  return (
    <Drawer.Root opened={opened} onClose={onClose} position="bottom" size="auto">
      <Drawer.Overlay backgroundOpacity={0.45} />
      <Drawer.Content
        aria-label={tr("graph.nodeDetails")}
        style={{
          ...SURFACE_STYLE,
          maxHeight: "70vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transform: `translateY(${dragOffset}px)`,
          transition: dragging ? "none" : "transform 0.25s cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        <div
          {...handlers}
          style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "#555",
              margin: "10px auto 0",
              flexShrink: 0,
            }}
          />
          <Drawer.Header
            style={{
              ...SURFACE_STYLE,
              borderBottom: "1px solid rgba(134, 142, 150, 0.2)",
              flexShrink: 0,
            }}
          >
            <Drawer.Title style={{ color: "#F8F9FA", fontWeight: 600 }}>
              {node?.displayName}
            </Drawer.Title>
            <Drawer.CloseButton style={{ color: "#868e96" }} />
          </Drawer.Header>
          <Drawer.Body style={{ flex: 1, minHeight: 0, padding: 0 }}>
            {node ? (
              <ScrollArea.Autosize
                mah="calc(70vh - 60px)"
                type="auto"
                offsetScrollbars
                viewportRef={scrollRef}
              >
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
          </Drawer.Body>
        </div>
      </Drawer.Content>
    </Drawer.Root>
  );
}
