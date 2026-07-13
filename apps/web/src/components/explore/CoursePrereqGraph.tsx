import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Popover, Text } from "@mantine/core";
import { Link } from "@tanstack/react-router";
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
import { tr } from "../../i18n";
import { courseNormToPathParam } from "../../lib/explore/courseSearchParams";
import { EMPTY_EXPLORE_SEARCH } from "../../lib/explore/exploreFilters";
import type { ExploreSearchParams } from "../../lib/explore/exploreFilters";
import classes from "./CoursePrereqGraph.module.css";

// ---------------------------------------------------------------------------
// Layout constants
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
const MAX_VIEWPORT_HEIGHT = 156;

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

function statusClass(status: PrereqNodeStatus): string {
  switch (status) {
    case "met":
      return classes.met!;
    case "missing":
      return classes.missing!;
    default:
      return classes.unknown!;
  }
}

function statusAriaLabel(status: PrereqNodeStatus): string {
  switch (status) {
    case "met":
      return tr("prereqGraph.status.met");
    case "missing":
      return tr("prereqGraph.status.missing");
    default:
      return tr("prereqGraph.status.unknown");
  }
}

function statusIcon(status: PrereqNodeStatus): string {
  switch (status) {
    case "met":
      return "✓";
    case "missing":
      return "✗";
    default:
      return "?";
  }
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

  let stroke: string;
  let dashArray: string | undefined;
  switch (edge.status) {
    case "met":
      stroke = "var(--mantine-color-constructGreen-6)";
      break;
    case "missing":
      stroke = "var(--mantine-color-constructRed-6)";
      dashArray = "4 3";
      break;
    default:
      stroke = "var(--app-border-strong)";
      dashArray = "2 2";
  }

  return (
    <path
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

function CourseNode({
  node,
  linkSearch,
}: {
  node: PrereqGraphCourseNode;
  linkSearch?: ExploreSearchParams;
}) {
  const isTarget = node.role === "target";
  const ariaLabel = [node.code, node.programLabel, statusAriaLabel(node.status)]
    .filter(Boolean)
    .join(": ");

  const style: React.CSSProperties = {
    left: nodeX(node),
    top: nodeY(node),
    width: nodeWidth(node),
    height: nodeHeight(node),
  };

  const className = [
    classes.node,
    statusClass(node.status),
    isTarget ? classes.target : "",
    !isTarget && node.resolvable ? classes.linkNode : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (isTarget) {
    return (
      <span
        className={className}
        style={style}
        aria-label={ariaLabel}
        title={statusAriaLabel(node.status)}
        data-testid="prereq-target"
      >
        <span aria-hidden="true" style={{ marginInlineEnd: 4, fontSize: 10 }}>
          {statusIcon(node.status)}
        </span>
        <span className={classes.courseContent}>
          <span>{node.code}</span>
          {node.programLabel ? (
            <span className={classes.programLabel}>{node.programLabel}</span>
          ) : null}
        </span>
      </span>
    );
  }

  if (node.resolvable) {
    return (
      <Link
        to="/explore/course/$course"
        params={{ course: courseNormToPathParam(node.code) }}
        search={linkSearch ?? EMPTY_EXPLORE_SEARCH}
        className={className}
        style={style}
        aria-label={ariaLabel}
        title={statusAriaLabel(node.status)}
      >
        <span aria-hidden="true" style={{ marginInlineEnd: 4, fontSize: 10 }}>
          {statusIcon(node.status)}
        </span>
        <span className={classes.courseContent}>
          <span>{node.code}</span>
          {node.programLabel ? (
            <span className={classes.programLabel}>{node.programLabel}</span>
          ) : null}
        </span>
      </Link>
    );
  }

  return (
    <span
      className={className}
      style={style}
      aria-label={ariaLabel}
      title={statusAriaLabel(node.status)}
    >
      <span aria-hidden="true" style={{ marginInlineEnd: 4, fontSize: 10 }}>
        {statusIcon(node.status)}
      </span>
      <span className={classes.courseContent}>
        <span>{node.code}</span>
        {node.programLabel ? (
          <span className={classes.programLabel}>{node.programLabel}</span>
        ) : null}
      </span>
    </span>
  );
}

function GateNodeEl({ node }: { node: PrereqGraphGateNode }) {
  const style: React.CSSProperties = {
    left: nodeX(node),
    top: nodeY(node),
    width: nodeWidth(node),
    height: nodeHeight(node),
  };

  return (
    <span
      className={`${classes.node} ${node.programLabel ? "" : classes.gate} ${statusClass(node.status)}`}
      style={style}
      aria-hidden="true"
      title={node.label}
    >
      {node.label}
    </span>
  );
}

function SemanticNodeEl({ node }: { node: PrereqGraphSemanticNode }) {
  const [opened, setOpened] = useState(false);
  const hasDisclosure = Boolean(node.disclosureText);

  const style: React.CSSProperties = {
    left: nodeX(node),
    top: nodeY(node),
    width: SEMANTIC_W,
    height: SEMANTIC_H,
  };

  const ariaLabel = `${node.label}: ${statusAriaLabel(node.status)}`;
  const className = [
    classes.node,
    statusClass(node.status),
    hasDisclosure ? classes.disclosure : "",
  ]
    .filter(Boolean)
    .join(" ");

  if (hasDisclosure) {
    return (
      <Popover opened={opened} onChange={setOpened} position="bottom" withArrow shadow="md">
        <Popover.Target>
          <button
            type="button"
            className={className}
            style={style}
            aria-label={ariaLabel}
            aria-expanded={opened}
            title={statusAriaLabel(node.status)}
            onClick={() => setOpened((o) => !o)}
            data-testid="prereq-semantic-disclosure"
          >
            <span aria-hidden="true" style={{ marginInlineEnd: 4, fontSize: 10 }}>
              {statusIcon(node.status)}
            </span>
            {node.label}
          </button>
        </Popover.Target>
        <Popover.Dropdown>
          <Text size="sm" maw={280}>
            {node.disclosureText}
          </Text>
        </Popover.Dropdown>
      </Popover>
    );
  }

  return (
    <span
      className={className}
      style={style}
      aria-label={ariaLabel}
      title={statusAriaLabel(node.status)}
    >
      <span aria-hidden="true" style={{ marginInlineEnd: 4, fontSize: 10 }}>
        {statusIcon(node.status)}
      </span>
      {node.label}
    </span>
  );
}

function AggregateNodeEl({
  node,
  linkSearch,
}: {
  node: PrereqGraphAggregateNode;
  linkSearch?: ExploreSearchParams;
}) {
  const [opened, setOpened] = useState(false);

  const style: React.CSSProperties = {
    left: nodeX(node),
    top: nodeY(node),
    width: SEMANTIC_W,
    height: SEMANTIC_H,
  };

  const ariaLabel = `${node.label}: ${statusAriaLabel(node.status)}`;
  const className = [classes.node, statusClass(node.status), classes.disclosure]
    .filter(Boolean)
    .join(" ");

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom" withArrow shadow="md">
      <Popover.Target>
        <button
          type="button"
          className={className}
          style={style}
          aria-label={ariaLabel}
          aria-expanded={opened}
          title={statusAriaLabel(node.status)}
          onClick={() => setOpened((o) => !o)}
          data-testid="prereq-aggregate"
        >
          <span aria-hidden="true" style={{ marginInlineEnd: 4, fontSize: 10 }}>
            {statusIcon(node.status)}
          </span>
          {node.label}
        </button>
      </Popover.Target>
      <Popover.Dropdown>
        <AggregateChildList items={node.children} linkSearch={linkSearch} />
      </Popover.Dropdown>
    </Popover>
  );
}

function AggregateChildList({
  items,
  linkSearch,
}: {
  items: PrereqGraphAggregateChild[];
  linkSearch?: ExploreSearchParams;
}) {
  return (
    <ul className={classes.childList}>
      {items.map((child, index) => (
        <li
          key={child.kind === "course" ? child.code : `${child.label}-${index}`}
          className={classes.childItem}
        >
          <span
            aria-hidden="true"
            style={{ fontSize: 10 }}
            className={
              child.status === "met"
                ? classes.childMet
                : child.status === "missing"
                  ? classes.childMissing
                  : undefined
            }
          >
            {statusIcon(child.status)}
          </span>
          {child.kind === "course" && child.resolvable ? (
            <Link
              to="/explore/course/$course"
              params={{ course: courseNormToPathParam(child.code) }}
              search={linkSearch ?? EMPTY_EXPLORE_SEARCH}
              className={classes.childLink}
              aria-label={`${child.code}: ${child.programLabel ? `${child.programLabel}: ` : ""}${statusAriaLabel(child.status)}`}
            >
              {child.code}
              {child.programLabel ? ` · ${child.programLabel}` : ""}
            </Link>
          ) : child.kind === "course" ? (
            <span
              className={classes.childLink}
              aria-label={`${child.code}: ${child.programLabel ? `${child.programLabel}: ` : ""}${statusAriaLabel(child.status)}`}
            >
              {child.code}
              {child.programLabel ? ` · ${child.programLabel}` : ""}
            </span>
          ) : (
            <span
              className={classes.childLink}
              aria-label={`${child.label}: ${statusAriaLabel(child.status)}`}
            >
              {child.label}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export interface CoursePrereqGraphProps {
  graph: PrereqGraph;
  linkSearch?: ExploreSearchParams;
}

export function CoursePrereqGraph({ graph, linkSearch }: CoursePrereqGraphProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  const nodeMap = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);

  const canvasWidth =
    Math.max(...graph.nodes.map((node) => nodeX(node) + nodeWidth(node)), COURSE_W) + PAD;
  const canvasHeight = PAD * 2 + graph.laneCount * LANE_GAP;
  const viewportHeight = MAX_VIEWPORT_HEIGHT;
  const centeredY = (viewportHeight - canvasHeight) / 2 - (canvasHeight > viewportHeight ? 1 : 0);
  const [offset, setOffset] = useState({ x: 0, y: centeredY });
  const [panning, setPanning] = useState(false);

  const clampOffset = useCallback(
    (next: { x: number; y: number }) => {
      const viewport = viewportRef.current;
      if (!viewport) return next;
      const minX = Math.min(0, viewport.clientWidth - canvasWidth);
      const availableY = viewport.clientHeight - canvasHeight;
      return {
        x: Math.max(minX, Math.min(0, next.x)),
        y: availableY >= 0 ? availableY / 2 : Math.max(availableY, Math.min(0, next.y)),
      };
    },
    [canvasHeight, canvasWidth],
  );

  const updateOffset = useCallback(
    (next: { x: number; y: number }) => {
      setOffset((current) => {
        const clamped = clampOffset(next);
        return clamped.x === current.x && clamped.y === current.y ? current : clamped;
      });
    },
    [clampOffset],
  );

  useEffect(() => {
    setOffset({ x: 0, y: centeredY });
  }, [canvasHeight, canvasWidth, centeredY, graph.rootId]);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const clampCurrentOffset = () => {
      setOffset((current) => clampOffset(current));
    };
    clampCurrentOffset();
    const ro = new ResizeObserver(clampCurrentOffset);
    ro.observe(el);
    return () => ro.disconnect();
  }, [clampOffset]);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (event.button !== 0 || (event.target as Element).closest("a, button")) return;
      event.preventDefault();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: offset.x,
        originY: offset.y,
      };
      event.currentTarget.setPointerCapture(event.pointerId);
      setPanning(true);
    },
    [offset.x, offset.y],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      updateOffset({
        x: drag.originX + event.clientX - drag.startX,
        y: drag.originY + event.clientY - drag.startY,
      });
    },
    [updateOffset],
  );

  const endPan = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    setPanning(false);
  }, []);

  const handleFocus = useCallback(
    (event: React.FocusEvent<HTMLElement>) => {
      const viewport = viewportRef.current;
      if (!viewport || event.target === viewport) return;
      const viewportBounds = viewport.getBoundingClientRect();
      const targetBounds = (event.target as HTMLElement).getBoundingClientRect();
      const margin = 8;
      let deltaX = 0;
      let deltaY = 0;

      if (targetBounds.left < viewportBounds.left + margin) {
        deltaX = viewportBounds.left + margin - targetBounds.left;
      } else if (targetBounds.right > viewportBounds.right - margin) {
        deltaX = viewportBounds.right - margin - targetBounds.right;
      }
      if (targetBounds.top < viewportBounds.top + margin) {
        deltaY = viewportBounds.top + margin - targetBounds.top;
      } else if (targetBounds.bottom > viewportBounds.bottom - margin) {
        deltaY = viewportBounds.bottom - margin - targetBounds.bottom;
      }

      if (deltaX !== 0 || deltaY !== 0) {
        updateOffset({ x: offset.x + deltaX, y: offset.y + deltaY });
      }
    },
    [offset.x, offset.y, updateOffset],
  );

  return (
    <figure
      ref={viewportRef}
      className={`${classes.viewport} ${panning ? classes.panning : ""}`}
      style={{
        height: viewportHeight,
        margin: 0,
        backgroundPosition: `${offset.x}px ${offset.y}px`,
      }}
      aria-label={graph.a11yDescription}
      data-testid="prereq-graph"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endPan}
      onPointerCancel={endPan}
      onFocusCapture={handleFocus}
    >
      <div
        className={classes.canvas}
        style={{
          width: canvasWidth,
          height: canvasHeight,
          transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
        }}
      >
        <svg
          className={classes.edgeLayer}
          width={canvasWidth}
          height={canvasHeight}
          aria-hidden="true"
        >
          <defs>
            <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="6" refY="2" orient="auto">
              <polygon points="0 0, 6 2, 0 4" fill="var(--app-border-strong)" />
            </marker>
          </defs>
          {graph.edges.map((edge) => (
            <EdgePath key={edge.id} edge={edge} nodeMap={nodeMap} />
          ))}
        </svg>

        {graph.nodes.map((node) => {
          switch (node.kind) {
            case "course":
              return <CourseNode key={node.id} node={node} linkSearch={linkSearch} />;
            case "and_gate":
            case "or_gate":
              return <GateNodeEl key={node.id} node={node} />;
            case "semantic":
              return <SemanticNodeEl key={node.id} node={node} />;
            case "aggregate":
              return <AggregateNodeEl key={node.id} node={node} linkSearch={linkSearch} />;
          }
        })}
      </div>
    </figure>
  );
}
