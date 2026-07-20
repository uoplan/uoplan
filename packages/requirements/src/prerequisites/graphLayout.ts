import type { PrereqGraphEdge, PrereqGraphNode } from "./graphTypes";

export function assignRanksAndLanes(
  nodes: PrereqGraphNode[],
  edges: PrereqGraphEdge[],
  targetId: string,
): void {
  // Build adjacency: for each node, which nodes feed into it (sources)
  const incomingMap = new Map<string, string[]>();
  const outgoingMap = new Map<string, string[]>();
  for (const edge of edges) {
    const incoming = incomingMap.get(edge.targetId) ?? [];
    incoming.push(edge.sourceId);
    incomingMap.set(edge.targetId, incoming);

    const outgoing = outgoingMap.get(edge.sourceId) ?? [];
    outgoing.push(edge.targetId);
    outgoingMap.set(edge.sourceId, outgoing);
  }

  // Compute rank: BFS from target backwards (target gets max rank)
  const rankFromTarget = new Map<string, number>();
  const queue: string[] = [targetId];
  rankFromTarget.set(targetId, 0);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentRank = rankFromTarget.get(current)!;
    const sources = incomingMap.get(current) ?? [];
    for (const src of sources) {
      const existingRank = rankFromTarget.get(src);
      const newRank = currentRank + 1;
      if (existingRank === undefined || newRank > existingRank) {
        rankFromTarget.set(src, newRank);
        queue.push(src);
      }
    }
  }

  // Find max rank to invert (leaves get rank 0, target gets max)
  const maxRank = Math.max(...rankFromTarget.values(), 0);

  // Assign ranks
  for (const node of nodes) {
    const fromTarget = rankFromTarget.get(node.id);
    if (fromTarget !== undefined) {
      node.rank = maxRank - fromTarget;
    } else {
      // Nodes not connected (shouldn't happen, but safe default)
      node.rank = 0;
    }
  }

  // Recompute lanes for gate nodes and target based on children average
  for (const node of nodes) {
    if (node.kind === "and_gate" || node.kind === "or_gate") {
      const sources = incomingMap.get(node.id) ?? [];
      if (sources.length > 0) {
        const childLanes = sources
          .map((s) => nodes.find((n) => n.id === s))
          .filter((n) => n !== undefined)
          .map((n) => n.lane);
        if (childLanes.length > 0) {
          node.lane = childLanes.reduce((a, b) => a + b, 0) / childLanes.length;
        }
      }
    }
  }

  // Target lane: average of its incoming sources
  const targetNode = nodes.find((n) => n.id === targetId);
  if (targetNode) {
    const sources = incomingMap.get(targetId) ?? [];
    if (sources.length > 0) {
      const childLanes = sources
        .map((s) => nodes.find((n) => n.id === s))
        .filter((n) => n !== undefined)
        .map((n) => n.lane);
      if (childLanes.length > 0) {
        targetNode.lane = childLanes.reduce((a, b) => a + b, 0) / childLanes.length;
      }
    }
  }
}
