import type Graph from "graphology";
import type { ProfessorGraphNode } from "@uoplan/schedule";

function hashId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function jitterFromId(id: string): { x: number; y: number } {
  const h = hashId(id);
  return {
    x: ((h % 100) / 100 - 0.5) * 10,
    y: (((h >> 8) % 100) / 100 - 0.5) * 10,
  };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let intersection = 0;
  for (const x of a) {
    if (b.has(x)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

/**
 * After ForceAtlas2, move degree-0 nodes near connected professors with similar subjects.
 */
export function placeIsolatedNodes(graph: Graph, nodes: ProfessorGraphNode[]): void {
  const connected = nodes.filter((n) => n.degree > 0);
  const isolated = nodes.filter((n) => n.degree === 0);
  if (isolated.length === 0 || connected.length === 0) return;

  const subjectById = new Map(connected.map((n) => [n.id, new Set(n.subjects)]));

  let maxR = 50;
  for (const n of connected) {
    const x = graph.getNodeAttribute(n.id, "x") as number;
    const y = graph.getNodeAttribute(n.id, "y") as number;
    maxR = Math.max(maxR, Math.hypot(x, y));
  }

  for (const node of isolated) {
    const subs = new Set(node.subjects);
    const scored: { id: string; score: number }[] = [];

    for (const anchor of connected) {
      const score = jaccard(subs, subjectById.get(anchor.id)!);
      if (score > 0) scored.push({ id: anchor.id, score });
    }

    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, 5);

    if (top.length > 0) {
      let x = 0;
      let y = 0;
      let wSum = 0;
      for (const t of top) {
        x += (graph.getNodeAttribute(t.id, "x") as number) * t.score;
        y += (graph.getNodeAttribute(t.id, "y") as number) * t.score;
        wSum += t.score;
      }
      const jitter = jitterFromId(node.id);
      graph.setNodeAttribute(node.id, "x", x / wSum + jitter.x);
      graph.setNodeAttribute(node.id, "y", y / wSum + jitter.y);
    } else {
      const angle = (hashId(node.id) % 360) * (Math.PI / 180);
      const r = maxR * 1.12;
      graph.setNodeAttribute(node.id, "x", Math.cos(angle) * r);
      graph.setNodeAttribute(node.id, "y", Math.sin(angle) * r);
    }
  }
}
