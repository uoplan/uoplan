import { computeForceLayout, type GraphEdge, type GraphNode } from "@/lib/force-layout";

// Pure force-directed layout used by the native professor graph. The web graph
// uses Sigma/forceAtlas2 (WebGL); this is a Hermes-friendly all-JS replacement,
// so it must be deterministic, finite, normalized to [0, 1], and pull connected
// nodes closer than unconnected ones.
describe("computeForceLayout", () => {
  const nodes: GraphNode[] = [
    { id: "a", label: "A" },
    { id: "b", label: "B" },
    { id: "c", label: "C" },
    { id: "d", label: "D" },
  ];
  const edges: GraphEdge[] = [
    { source: "a", target: "b", weight: 3 },
    { source: "c", target: "d", weight: 3 },
  ];

  it("returns one normalized, finite position per node", () => {
    const layout = computeForceLayout(nodes, edges);
    expect(layout).toHaveLength(4);
    for (const n of layout) {
      expect(Number.isFinite(n.x)).toBe(true);
      expect(Number.isFinite(n.y)).toBe(true);
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(1);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(1);
    }
  });

  it("counts degree from incident edges", () => {
    const layout = computeForceLayout(nodes, edges);
    const byId = new Map(layout.map((n) => [n.id, n]));
    expect(byId.get("a")?.degree).toBe(1);
    expect(byId.get("b")?.degree).toBe(1);
  });

  it("is deterministic for the same input", () => {
    const a = computeForceLayout(nodes, edges);
    const b = computeForceLayout(nodes, edges);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("places connected nodes closer than unconnected ones", () => {
    const layout = computeForceLayout(nodes, edges);
    const byId = new Map(layout.map((n) => [n.id, n]));
    const dist = (p: string, q: string) => {
      const a = byId.get(p)!;
      const b = byId.get(q)!;
      return Math.hypot(a.x - b.x, a.y - b.y);
    };
    // a–b are connected; a–c are not.
    expect(dist("a", "b")).toBeLessThan(dist("a", "c"));
  });

  it("handles an empty graph", () => {
    expect(computeForceLayout([], [])).toEqual([]);
  });

  it("ignores edges referencing unknown nodes", () => {
    const layout = computeForceLayout(nodes, [{ source: "a", target: "zzz" }]);
    expect(layout).toHaveLength(4);
    const byId = new Map(layout.map((n) => [n.id, n]));
    // An edge to an unknown node is dropped entirely, so it adds no degree.
    expect(byId.get("a")?.degree).toBe(0);
    expect(byId.get("b")?.degree).toBe(0);
  });
});
