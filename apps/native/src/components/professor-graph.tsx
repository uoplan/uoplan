import { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Line, Text as SvgText } from "react-native-svg";

import { Surface } from "@/constants/theme";
import { computeForceLayout, type GraphEdge, type GraphNode } from "@/lib/force-layout";

export interface ProfessorGraphProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** Maps a node's `group` to a colour. */
  colorFor: (group?: string) => string;
  /** Svg height. Width is measured from the container. */
  height?: number;
  /** Explicit width (otherwise measured via onLayout). */
  width?: number;
  selectedId?: string;
  onSelect?: (id: string) => void;
}

const PAD = 18;

/**
 * Professor co-occurrence network rendered with react-native-svg — the native
 * analogue of the web `/graph` page (which uses Sigma/forceAtlas2 on WebGL). A
 * pure-JS force layout ({@link computeForceLayout}) settles node positions; edges
 * are drawn as weighted lines and nodes as discipline-coloured circles sized by
 * degree. Tapping a node selects it (drives an external details panel).
 */
export function ProfessorGraph({
  nodes,
  edges,
  colorFor,
  height = 300,
  width: widthProp,
  selectedId,
  onSelect,
}: ProfessorGraphProps) {
  const [measured, setMeasured] = useState(0);
  const width = widthProp ?? measured;

  const layout = useMemo(() => computeForceLayout(nodes, edges), [nodes, edges]);
  const byId = useMemo(() => new Map(layout.map((n) => [n.id, n])), [layout]);
  const maxDegree = useMemo(() => Math.max(1, ...layout.map((n) => n.degree)), [layout]);

  const plotW = Math.max(0, width - PAD * 2);
  const plotH = height - PAD * 2;
  const px = (x: number) => PAD + x * plotW;
  const py = (y: number) => PAD + y * plotH;
  const radiusFor = (degree: number) => 7 + (degree / maxDegree) * 9;

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setMeasured(e.nativeEvent.layout.width)}
      testID="professor-graph"
    >
      {width > 0 && (
        <Svg width={width} height={height}>
          {edges.map((edge, i) => {
            const a = byId.get(edge.source);
            const b = byId.get(edge.target);
            if (!a || !b) return null;
            const active = selectedId === edge.source || selectedId === edge.target;
            return (
              <Line
                key={`e${i}`}
                x1={px(a.x)}
                y1={py(a.y)}
                x2={px(b.x)}
                y2={py(b.y)}
                stroke={active ? Surface.accent : Surface.border}
                strokeWidth={active ? 2 : 1 + (edge.weight ?? 1) * 0.3}
                strokeOpacity={active ? 0.9 : 0.6}
              />
            );
          })}
          {layout.map((node) => {
            const selected = selectedId === node.id;
            const r = radiusFor(node.degree);
            return (
              <Circle
                key={node.id}
                cx={px(node.x)}
                cy={py(node.y)}
                r={selected ? r + 2 : r}
                fill={colorFor(node.group)}
                stroke={selected ? Surface.label : Surface.card}
                strokeWidth={selected ? 2.5 : 1.5}
                onPress={() => onSelect?.(node.id)}
              />
            );
          })}
          {selectedId &&
            byId.has(selectedId) &&
            (() => {
              const node = byId.get(selectedId)!;
              return (
                <SvgText
                  x={px(node.x)}
                  y={py(node.y) - radiusFor(node.degree) - 5}
                  fontSize={11}
                  fontWeight="600"
                  fill={Surface.label}
                  textAnchor="middle"
                >
                  {node.label}
                </SvgText>
              );
            })()}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
});
