export interface GraphNode {
  id: string;
  label: string;
  group?: string;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight?: number;
}

export interface LayoutNode extends GraphNode {
  /** Position normalized to [0, 1]. */
  x: number;
  y: number;
  /** Number of incident edges (drives node radius). */
  degree: number;
}

export interface ForceLayoutOptions {
  iterations?: number;
  repulsion?: number;
  spring?: number;
  /** Pulls nodes toward the centre so the graph stays compact. */
  gravity?: number;
}

/**
 * Tiny deterministic force-directed layout (Fruchterman–Reingold-ish) in pure
 * JS — no d3/graphology dependency. Nodes start on a unit circle (seeded by
 * index, so the result is reproducible), then settle under all-pairs repulsion +
 * per-edge spring attraction + a gravity term, and are finally normalized to the
 * unit square. This replaces the web graph's Sigma/forceAtlas2 (WebGL) renderer
 * with something that runs under Hermes and feeds react-native-svg.
 */
export function computeForceLayout(
  nodes: GraphNode[],
  edges: GraphEdge[],
  options: ForceLayoutOptions = {},
): LayoutNode[] {
  const { iterations = 220, repulsion = 0.04, spring = 0.02, gravity = 0.01 } = options;
  const n = nodes.length;
  if (n === 0) return [];

  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const pos = nodes.map((_, i) => ({
    x: Math.cos((2 * Math.PI * i) / n),
    y: Math.sin((2 * Math.PI * i) / n),
  }));
  const degree = new Array(n).fill(0);
  for (const edge of edges) {
    const a = index.get(edge.source);
    const b = index.get(edge.target);
    if (a === undefined || b === undefined) continue;
    degree[a] += 1;
    degree[b] += 1;
  }

  for (let iter = 0; iter < iterations; iter++) {
    const disp = pos.map(() => ({ x: 0, y: 0 }));

    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = pos[i].x - pos[j].x;
        const dy = pos[i].y - pos[j].y;
        const d2 = dx * dx + dy * dy + 0.01;
        const d = Math.sqrt(d2);
        const f = repulsion / d2;
        disp[i].x += (dx / d) * f;
        disp[i].y += (dy / d) * f;
        disp[j].x -= (dx / d) * f;
        disp[j].y -= (dy / d) * f;
      }
    }

    for (const edge of edges) {
      const a = index.get(edge.source);
      const b = index.get(edge.target);
      if (a === undefined || b === undefined) continue;
      const dx = pos[a].x - pos[b].x;
      const dy = pos[a].y - pos[b].y;
      const d = Math.sqrt(dx * dx + dy * dy) + 0.001;
      const f = spring * d * (edge.weight ?? 1);
      disp[a].x -= (dx / d) * f;
      disp[a].y -= (dy / d) * f;
      disp[b].x += (dx / d) * f;
      disp[b].y += (dy / d) * f;
    }

    for (let i = 0; i < n; i++) {
      pos[i].x += disp[i].x - pos[i].x * gravity;
      pos[i].y += disp[i].y - pos[i].y * gravity;
    }
  }

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pos) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;

  return nodes.map((node, i) => ({
    ...node,
    degree: degree[i],
    x: (pos[i].x - minX) / spanX,
    y: (pos[i].y - minY) / spanY,
  }));
}
