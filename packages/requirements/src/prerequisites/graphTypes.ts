import type { CoursePrereqNode } from "@uoplan/domain/dataTypes";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { NormalizedCourseCode } from "@uoplan/domain/brand";
import type { PrereqContext } from "./types";

export type PrereqNodeStatus = "met" | "missing" | "unknown";

export const PREREQ_GRAPH_FAN_OUT_LIMIT = 4;

export type PrereqGraphTr = (id: string, values?: Record<string, string | number>) => string;

/** Base fields shared by all graph nodes. */
interface PrereqGraphNodeBase {
  id: string;
  status: PrereqNodeStatus;
  rank: number;
  lane: number;
  programs?: string[];
  programLabel?: string;
}

export interface PrereqGraphCourseNode extends PrereqGraphNodeBase {
  kind: "course";
  role: "prerequisite" | "target";
  code: NormalizedCourseCode;
  resolvable: boolean;
}

export interface PrereqGraphGateNode extends PrereqGraphNodeBase {
  kind: "and_gate" | "or_gate";
  label: string;
}

export interface PrereqGraphSemanticNode extends PrereqGraphNodeBase {
  kind: "semantic";
  label: string;
  disclosureText?: string;
}

interface PrereqGraphAggregateChildBase {
  kind: "course" | "requirement";
  status: PrereqNodeStatus;
}

export interface PrereqGraphAggregateCourseChild extends PrereqGraphAggregateChildBase {
  kind: "course";
  code: NormalizedCourseCode;
  resolvable: boolean;
  programLabel?: string;
}

export interface PrereqGraphAggregateRequirementChild extends PrereqGraphAggregateChildBase {
  kind: "requirement";
  label: string;
}

export type PrereqGraphAggregateChild =
  | PrereqGraphAggregateCourseChild
  | PrereqGraphAggregateRequirementChild;

export interface PrereqGraphAggregateNode extends PrereqGraphNodeBase {
  kind: "aggregate";
  mode: "any" | "all";
  label: string;
  children: PrereqGraphAggregateChild[];
}

export type PrereqGraphNode =
  | PrereqGraphCourseNode
  | PrereqGraphGateNode
  | PrereqGraphSemanticNode
  | PrereqGraphAggregateNode;

export interface PrereqGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  status: PrereqNodeStatus;
}

export interface PrereqGraph {
  rootId: string;
  nodes: PrereqGraphNode[];
  edges: PrereqGraphEdge[];
  rankCount: number;
  laneCount: number;
  a11yDescription: string;
}

export interface BuildPrereqGraphOptions {
  courseCode: NormalizedCourseCode;
  prereqRoot: CoursePrereqNode;
  plannerContext: PrereqContext | null;
  cache: DataCache | null;
  tr: PrereqGraphTr;
  fanOutLimit?: number;
}
