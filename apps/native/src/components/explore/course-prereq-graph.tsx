import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, View } from "react-native";
import Svg, { Defs, Marker, Path, Polygon } from "react-native-svg";

import { Text } from "@uoplan/ui";
import type {
  PrereqGraph,
  PrereqGraphAggregateChild,
  PrereqGraphAggregateNode,
  PrereqGraphCourseNode,
  PrereqGraphEdge,
  PrereqGraphGateNode,
  PrereqGraphNode,
  PrereqGraphSemanticNode,
  PrereqNodeStatus,
} from "@uoplan/core";

import { AppIcon } from "@/components/app-icon";
import { Spacing, Surface } from "@/constants/theme";
import { useTr } from "@/i18n";

// ---------------------------------------------------------------------------
// Layout constants (aligned with web)
// ---------------------------------------------------------------------------

const COURSE_W = 92;
const COURSE_H = 40;
const QUALIFIED_COURSE_H = 52;
const SEMANTIC_W = 132;
const SEMANTIC_H = 40;
const GATE_SIZE = 32;
const RANK_GAP = 72;
const LANE_GAP = 58;
const PAD = 16;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nodeWidth(node: PrereqGraphNode): number {
  if (node.kind === "and_gate" || node.kind === "or_gate") {
    return node.programLabel ? SEMANTIC_W : GATE_SIZE;
  }
  if (node.kind === "course" && node.programLabel) return SEMANTIC_W;
  if (node.kind === "semantic" || node.kind === "aggregate") return SEMANTIC_W;
  return COURSE_W;
}

function nodeHeight(node: PrereqGraphNode): number {
  if (node.kind === "and_gate" || node.kind === "or_gate") {
    return node.programLabel ? SEMANTIC_H : GATE_SIZE;
  }
  if (node.kind === "course" && node.programLabel) return QUALIFIED_COURSE_H;
  return COURSE_H;
}

function nodeX(node: PrereqGraphNode): number {
  return PAD + node.rank * (COURSE_W + RANK_GAP);
}

function nodeY(node: PrereqGraphNode): number {
  const h = nodeHeight(node);
  const cellMid = PAD + node.lane * LANE_GAP + LANE_GAP / 2;
  return cellMid - h / 2;
}

function statusColor(status: PrereqNodeStatus): string {
  switch (status) {
    case "met":
      return Surface.success;
    case "missing":
      return Surface.danger;
    default:
      return Surface.border;
  }
}

function statusBorderColor(status: PrereqNodeStatus): string {
  switch (status) {
    case "met":
      return Surface.success;
    case "missing":
      return Surface.danger;
    default:
      return Surface.border;
  }
}

function statusIcon(
  status: PrereqNodeStatus,
): "checkmark.circle" | "xmark.circle" | "questionmark.circle" {
  switch (status) {
    case "met":
      return "checkmark.circle";
    case "missing":
      return "xmark.circle";
    default:
      return "questionmark.circle";
  }
}

interface CoursePrereqGraphProps {
  graph: PrereqGraph;
  onNavigateCourse?: (code: string) => void;
}

/**
 * Native prerequisite graph renderer — matches the web graph layout:
 * horizontal left-to-right DAG with SVG edges + absolutely positioned nodes.
 * Wrapped in a horizontal ScrollView for bounded pan.
 */
export function CoursePrereqGraph({ graph, onNavigateCourse }: CoursePrereqGraphProps) {
  const tr = useTr();
  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const canvasWidth =
    Math.max(...graph.nodes.map((node) => nodeX(node) + nodeWidth(node)), COURSE_W) + PAD;
  const canvasHeight = PAD * 2 + graph.laneCount * LANE_GAP;

  const [sheetState, setSheetState] = useState<
    | {
        kind: "aggregate";
        node: PrereqGraphAggregateNode;
      }
    | {
        kind: "semantic";
        text: string;
      }
    | null
  >(null);

  const statusAriaLabel = (status: PrereqNodeStatus): string => {
    switch (status) {
      case "met":
        return tr("prereqGraph.status.met");
      case "missing":
        return tr("prereqGraph.status.missing");
      default:
        return tr("prereqGraph.status.unknown");
    }
  };

  return (
    <View testID="prereq-graph">
      <View
        accessible
        accessibilityLabel={graph.a11yDescription}
        style={styles.accessibilitySummary}
      />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        testID="prereq-graph-scroll"
        style={styles.scrollView}
        contentContainerStyle={{ width: canvasWidth, height: canvasHeight }}
      >
        {/* SVG edge layer */}
        <Svg
          width={canvasWidth}
          height={canvasHeight}
          style={StyleSheet.absoluteFill}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          testID="prereq-graph-svg"
        >
          <Defs>
            <Marker id="arrowhead" markerWidth={6} markerHeight={4} refX={6} refY={2} orient="auto">
              <Polygon points="0,0 6,2 0,4" fill={Surface.border} />
            </Marker>
          </Defs>
          {graph.edges.map((edge) => (
            <EdgePath key={edge.id} edge={edge} nodeMap={nodeMap} />
          ))}
        </Svg>

        {/* Node overlay layer */}
        {graph.nodes.map((node) => {
          switch (node.kind) {
            case "course":
              return (
                <CourseNodeEl
                  key={node.id}
                  node={node}
                  statusAriaLabel={statusAriaLabel}
                  onPress={onNavigateCourse}
                />
              );
            case "and_gate":
            case "or_gate":
              return <GateNodeEl key={node.id} node={node} />;
            case "semantic":
              return (
                <SemanticNodeEl
                  key={node.id}
                  node={node}
                  statusAriaLabel={statusAriaLabel}
                  onDisclosure={(text) => setSheetState({ kind: "semantic", text })}
                />
              );
            case "aggregate":
              return (
                <AggregateNodeEl
                  key={node.id}
                  node={node}
                  statusAriaLabel={statusAriaLabel}
                  onPress={() => setSheetState({ kind: "aggregate", node })}
                />
              );
          }
        })}
      </ScrollView>

      {/* Detail sheet for aggregate/semantic disclosure */}
      <PrereqDetailSheet
        sheetState={sheetState}
        onClose={() => setSheetState(null)}
        onNavigateCourse={onNavigateCourse}
        statusAriaLabel={statusAriaLabel}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Edge SVG
// ---------------------------------------------------------------------------

function EdgePath({
  edge,
  nodeMap,
}: {
  edge: PrereqGraphEdge;
  nodeMap: Map<string, PrereqGraphNode>;
}) {
  const source = nodeMap.get(edge.sourceId);
  const target = nodeMap.get(edge.targetId);
  if (!source || !target) return null;

  const sx = nodeX(source) + nodeWidth(source);
  const sy = nodeY(source) + nodeHeight(source) / 2;
  const tx = nodeX(target);
  const ty = nodeY(target) + nodeHeight(target) / 2;

  const midX = (sx + tx) / 2;
  const d = `M ${sx} ${sy} C ${midX} ${sy}, ${midX} ${ty}, ${tx} ${ty}`;

  const stroke = statusColor(edge.status);
  const dashArray =
    edge.status === "missing" ? "4,3" : edge.status === "unknown" ? "2,2" : undefined;

  return (
    <Path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={1.5}
      strokeDasharray={dashArray}
      markerEnd="url(#arrowhead)"
    />
  );
}

// ---------------------------------------------------------------------------
// Node components
// ---------------------------------------------------------------------------

function CourseNodeEl({
  node,
  statusAriaLabel,
  onPress,
}: {
  node: PrereqGraphCourseNode;
  statusAriaLabel: (s: PrereqNodeStatus) => string;
  onPress?: (code: string) => void;
}) {
  const isTarget = node.role === "target";
  const label = [node.code, node.programLabel, statusAriaLabel(node.status)]
    .filter(Boolean)
    .join(": ");

  const nodeStyle = [
    styles.node,
    styles.courseNode,
    {
      left: nodeX(node),
      top: nodeY(node),
      width: nodeWidth(node),
      height: nodeHeight(node),
      borderColor: statusBorderColor(node.status),
    },
    isTarget && styles.targetNode,
  ];

  if (!isTarget && node.resolvable && onPress) {
    return (
      <Pressable
        style={nodeStyle}
        onPress={() => onPress(node.code)}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID={`prereq-course-${node.code}`}
      >
        <AppIcon name={statusIcon(node.status)} size={12} color={statusColor(node.status)} />
        <View style={styles.courseLabel}>
          <Text size="xs" weight="bold" numberOfLines={1}>
            {node.code}
          </Text>
          {node.programLabel ? (
            <Text size="xs" color={Surface.dimmed} numberOfLines={1}>
              {node.programLabel}
            </Text>
          ) : null}
        </View>
      </Pressable>
    );
  }

  return (
    <View
      style={nodeStyle}
      accessible
      accessibilityLabel={label}
      testID={isTarget ? "prereq-target" : `prereq-course-${node.code}`}
    >
      <AppIcon name={statusIcon(node.status)} size={12} color={statusColor(node.status)} />
      <View style={styles.courseLabel}>
        <Text size="xs" weight="bold" numberOfLines={1}>
          {node.code}
        </Text>
        {node.programLabel ? (
          <Text size="xs" color={Surface.dimmed} numberOfLines={1}>
            {node.programLabel}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

function GateNodeEl({ node }: { node: PrereqGraphGateNode }) {
  return (
    <View
      style={[
        styles.node,
        {
          left: nodeX(node),
          top: nodeY(node),
          width: nodeWidth(node),
          height: nodeHeight(node),
          borderColor: statusBorderColor(node.status),
        },
        !node.programLabel && styles.gateNode,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text size="xs" weight="bold" color={Surface.dimmed}>
        {node.label}
      </Text>
    </View>
  );
}

function SemanticNodeEl({
  node,
  statusAriaLabel,
  onDisclosure,
}: {
  node: PrereqGraphSemanticNode;
  statusAriaLabel: (s: PrereqNodeStatus) => string;
  onDisclosure: (text: string) => void;
}) {
  const label = `${node.label}: ${statusAriaLabel(node.status)}`;
  const hasDisclosure = Boolean(node.disclosureText);

  const nodeStyle = [
    styles.node,
    styles.semanticNode,
    {
      left: nodeX(node),
      top: nodeY(node),
      width: SEMANTIC_W,
      height: SEMANTIC_H,
      borderColor: statusBorderColor(node.status),
    },
  ];

  if (hasDisclosure) {
    return (
      <Pressable
        style={nodeStyle}
        onPress={() => onDisclosure(node.disclosureText!)}
        accessibilityRole="button"
        accessibilityLabel={label}
        testID="prereq-semantic-disclosure"
      >
        <AppIcon name={statusIcon(node.status)} size={12} color={statusColor(node.status)} />
        <View style={styles.nodeLabel}>
          <Text size="xs" numberOfLines={1}>
            {node.label}
          </Text>
        </View>
      </Pressable>
    );
  }

  return (
    <View style={nodeStyle} accessible accessibilityLabel={label}>
      <AppIcon name={statusIcon(node.status)} size={12} color={statusColor(node.status)} />
      <View style={styles.nodeLabel}>
        <Text size="xs" numberOfLines={1}>
          {node.label}
        </Text>
      </View>
    </View>
  );
}

function AggregateNodeEl({
  node,
  statusAriaLabel,
  onPress,
}: {
  node: PrereqGraphAggregateNode;
  statusAriaLabel: (s: PrereqNodeStatus) => string;
  onPress: () => void;
}) {
  const label = `${node.label}: ${statusAriaLabel(node.status)}`;

  return (
    <Pressable
      style={[
        styles.node,
        styles.semanticNode,
        {
          left: nodeX(node),
          top: nodeY(node),
          width: SEMANTIC_W,
          height: SEMANTIC_H,
          borderColor: statusBorderColor(node.status),
        },
      ]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      testID="prereq-aggregate"
    >
      <AppIcon name={statusIcon(node.status)} size={12} color={statusColor(node.status)} />
      <View style={styles.nodeLabel}>
        <Text size="xs" numberOfLines={1}>
          {node.label}
        </Text>
      </View>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Detail Sheet (aggregate list / semantic full text)
// ---------------------------------------------------------------------------

function PrereqDetailSheet({
  sheetState,
  onClose,
  onNavigateCourse,
  statusAriaLabel,
}: {
  sheetState:
    | {
        kind: "aggregate";
        node: PrereqGraphAggregateNode;
      }
    | {
        kind: "semantic";
        text: string;
      }
    | null;
  onClose: () => void;
  onNavigateCourse?: (code: string) => void;
  statusAriaLabel: (s: PrereqNodeStatus) => string;
}) {
  const tr = useTr();
  if (!sheetState) return null;

  return (
    <Modal
      visible
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID="prereq-detail-sheet"
    >
      <View style={sheetStyles.root}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onClose}
          accessible={false}
          testID="prereq-detail-backdrop"
        />
        <View style={sheetStyles.sheet}>
          <View style={sheetStyles.handle} />
          <View style={sheetStyles.titleRow}>
            <Text size="lg" weight="bold">
              {sheetState.kind === "aggregate" ? sheetState.node.label : tr("prereqGraph.details")}
            </Text>
            <Pressable
              onPress={onClose}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={tr("graph.close")}
            >
              <AppIcon name="xmark" size={18} color={Surface.dimmed} />
            </Pressable>
          </View>
          <ScrollView
            style={sheetStyles.scroll}
            contentContainerStyle={sheetStyles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {sheetState.kind === "aggregate" ? (
              <AggregateChildList
                items={sheetState.node.children}
                onNavigateCourse={onNavigateCourse}
                statusAriaLabel={statusAriaLabel}
              />
            ) : (
              <Text size="sm" color={Surface.label}>
                {sheetState.text}
              </Text>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function AggregateChildList({
  items,
  onNavigateCourse,
  statusAriaLabel,
}: {
  items: PrereqGraphAggregateChild[];
  onNavigateCourse?: (code: string) => void;
  statusAriaLabel: (s: PrereqNodeStatus) => string;
}) {
  return (
    <View style={sheetStyles.childList}>
      {items.map((child, index) => {
        const childLabel =
          child.kind === "course"
            ? `${child.code}${child.programLabel ? ` · ${child.programLabel}` : ""}`
            : child.label;
        const label = `${childLabel}: ${statusAriaLabel(child.status)}`;
        if (child.kind === "course" && child.resolvable && onNavigateCourse) {
          return (
            <Pressable
              key={child.code}
              style={sheetStyles.childItem}
              onPress={() => onNavigateCourse(child.code)}
              accessibilityRole="button"
              accessibilityLabel={label}
              testID={`aggregate-child-${child.code}`}
            >
              <AppIcon
                name={statusIcon(child.status)}
                size={14}
                color={statusColor(child.status)}
              />
              <Text size="sm" weight="bold" color={Surface.accent}>
                {child.code}
              </Text>
            </Pressable>
          );
        }
        return (
          <View
            key={child.kind === "course" ? child.code : `${child.label}-${index}`}
            style={sheetStyles.childItem}
            accessible
            accessibilityLabel={label}
          >
            <AppIcon name={statusIcon(child.status)} size={14} color={statusColor(child.status)} />
            <Text size="sm" color={Surface.label}>
              {childLabel}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  accessibilitySummary: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
  },
  scrollView: {
    overflow: "hidden",
  },
  node: {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1.5,
    borderRadius: 8,
    backgroundColor: Surface.card,
  },
  courseNode: {
    paddingHorizontal: Spacing.one,
  },
  courseLabel: {
    minWidth: 0,
    alignItems: "center",
  },
  targetNode: {
    borderWidth: 2,
    backgroundColor: Surface.subtle,
  },
  gateNode: {
    borderRadius: 16,
  },
  semanticNode: {
    paddingHorizontal: Spacing.two,
  },
  nodeLabel: {
    flex: 1,
  },
});

const sheetStyles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  sheet: {
    backgroundColor: Surface.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.five,
    maxHeight: "75%",
  },
  handle: {
    alignSelf: "center",
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Surface.border,
    marginBottom: Spacing.three,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: Spacing.three,
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    gap: Spacing.two,
  },
  childList: {
    gap: Spacing.two,
  },
  childItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
