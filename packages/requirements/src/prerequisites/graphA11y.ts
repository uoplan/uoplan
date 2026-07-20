import type { CoursePrereqNode } from "@uoplan/domain/dataTypes";
import type { DataCache } from "@uoplan/domain/dataCache";
import type { PrereqContext } from "./types";
import type { PrereqGraphTr, PrereqNodeStatus } from "./graphTypes";
import {
  computeCourseTakenStatus,
  computeNonCourseStatus,
  computeProgramStatus,
  gateStatusFromChildren,
  isResolvableCourse,
} from "./graphStatus";
import { buildCreditSemanticLabel, buildSemanticLabel, withProgramQualifier } from "./graphLabels";

export function buildA11yDescription(
  prereqRoot: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
  tr: PrereqGraphTr,
): string {
  return describeNode(prereqRoot, ctx, cache, tr);
}

function describeNode(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
  tr: PrereqGraphTr,
): string {
  let description: string;
  switch (node.type) {
    case "course": {
      const code = node.code ?? "";
      const status = describeCourseStatus(node, ctx, cache);
      description = tr("prereqGraph.a11y.course", {
        code,
        status: trPrereqStatus(status, tr),
      });
      break;
    }
    case "and_group": {
      const childDescs = (node.children ?? []).map((child) => describeNode(child, ctx, cache, tr));
      const status = describeGateStatus(node, ctx, cache, "and");
      description = tr("prereqGraph.a11y.andGroup", {
        children: childDescs.join("; "),
        status: trPrereqStatus(status, tr),
      });
      break;
    }
    case "or_group": {
      const childDescs = (node.children ?? []).map((child) => describeNode(child, ctx, cache, tr));
      const status = describeGateStatus(node, ctx, cache, "or");
      description = tr("prereqGraph.a11y.orGroup", {
        children: childDescs.join("; "),
        status: trPrereqStatus(status, tr),
      });
      break;
    }
    case "non_course": {
      const label =
        node.credits != null ? buildCreditSemanticLabel(node, tr) : buildSemanticLabel(node, tr);
      const status = computeNonCourseStatus(node, ctx);
      description = tr("prereqGraph.a11y.semantic", {
        label,
        status: trPrereqStatus(status, tr),
      });
      break;
    }
    default:
      description = "";
  }
  return withProgramQualifier(description, node, tr);
}

function describeCourseStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
): PrereqNodeStatus {
  const programStatus = computeProgramStatus(node, ctx);
  if (programStatus !== "met") return programStatus;
  if (!isResolvableCourse(node.code ?? "", cache)) return "unknown";
  return computeCourseTakenStatus(node.code ?? "", ctx);
}

function describeGateStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext | null,
  cache: DataCache | null,
  kind: "and" | "or",
): PrereqNodeStatus {
  if (ctx === null) return "unknown";
  const gateKind: "and_gate" | "or_gate" = kind === "and" ? "and_gate" : "or_gate";
  const children = node.children ?? [];
  const statuses = children.map((child) => describeChildStatus(child, ctx, cache));
  return gateStatusFromChildren(node, ctx, gateKind, statuses);
}

function describeChildStatus(
  node: CoursePrereqNode,
  ctx: PrereqContext,
  cache: DataCache | null,
): PrereqNodeStatus {
  switch (node.type) {
    case "course":
      return describeCourseStatus(node, ctx, cache);
    case "and_group":
      return describeGateStatus(node, ctx, cache, "and");
    case "or_group":
      return describeGateStatus(node, ctx, cache, "or");
    case "non_course":
      return computeNonCourseStatus(node, ctx);
    default:
      return "unknown";
  }
}

function trPrereqStatus(status: PrereqNodeStatus, tr: PrereqGraphTr): string {
  switch (status) {
    case "met":
      return tr("prereqGraph.status.met");
    case "missing":
      return tr("prereqGraph.status.missing");
    default:
      return tr("prereqGraph.status.unknown");
  }
}
