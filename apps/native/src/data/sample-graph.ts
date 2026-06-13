import type { GraphEdge, GraphNode } from "@/lib/force-layout";

/**
 * Sample professor co-occurrence network used by the native graph view until the
 * live `.pb` data layer (C2) feeds the real professors/schedules graph. Nodes are
 * professors grouped by discipline; edges connect professors who co-teach or
 * share sections, weighted by how often. Mirrors the shape of the web `/graph`
 * page's professor network.
 */
export const SAMPLE_GRAPH_NODES: GraphNode[] = [
  { id: "iti-a", label: "Dr. Tremblay", group: "Computer Science" },
  { id: "iti-b", label: "Dr. Okonkwo", group: "Computer Science" },
  { id: "csi-a", label: "Dr. Laurent", group: "Computer Science" },
  { id: "csi-b", label: "Dr. Singh", group: "Computer Science" },
  { id: "mat-a", label: "Dr. Bélanger", group: "Mathematics" },
  { id: "mat-b", label: "Dr. Novak", group: "Mathematics" },
  { id: "phy-a", label: "Dr. Haddad", group: "Physics" },
  { id: "bio-a", label: "Dr. Côté", group: "Biology" },
  { id: "bio-b", label: "Dr. Ferreira", group: "Biology" },
  { id: "psy-a", label: "Dr. Murphy", group: "Psychology" },
  { id: "psy-b", label: "Dr. Wong", group: "Psychology" },
  { id: "eco-a", label: "Dr. Rossi", group: "Economics" },
];

export const SAMPLE_GRAPH_EDGES: GraphEdge[] = [
  { source: "iti-a", target: "iti-b", weight: 3 },
  { source: "iti-a", target: "csi-a", weight: 2 },
  { source: "iti-b", target: "csi-b", weight: 1 },
  { source: "csi-a", target: "csi-b", weight: 2 },
  { source: "csi-a", target: "mat-a", weight: 1 },
  { source: "mat-a", target: "mat-b", weight: 3 },
  { source: "mat-b", target: "phy-a", weight: 2 },
  { source: "phy-a", target: "mat-a", weight: 1 },
  { source: "bio-a", target: "bio-b", weight: 3 },
  { source: "bio-b", target: "psy-a", weight: 1 },
  { source: "psy-a", target: "psy-b", weight: 2 },
  { source: "psy-b", target: "eco-a", weight: 1 },
  { source: "eco-a", target: "mat-b", weight: 1 },
];

/** Stable discipline → colour map for node + legend tinting. */
export const GRAPH_GROUP_COLORS: Record<string, string> = {
  "Computer Science": "#8c1d40",
  Mathematics: "#2f6f4f",
  Physics: "#1f5f8b",
  Biology: "#b8860b",
  Psychology: "#7048a8",
  Economics: "#a14a2a",
};

export function graphGroupColor(group?: string): string {
  return (group && GRAPH_GROUP_COLORS[group]) || "#5e5a52";
}
