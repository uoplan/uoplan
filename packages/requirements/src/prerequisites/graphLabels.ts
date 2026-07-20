import type { CoursePrereqNode } from "@uoplan/domain/dataTypes";
import type { PrereqGraphTr } from "./graphTypes";

export function buildSemanticLabel(node: CoursePrereqNode, tr: PrereqGraphTr): string {
  if (node.kind !== undefined) {
    switch (node.kind) {
      case "permission":
        return tr("prereqGraph.kind.permission");
      case "audition":
        return tr("prereqGraph.kind.audition");
      case "language":
        return tr("prereqGraph.kind.language");
      case "equivalent":
        return tr("prereqGraph.kind.equivalent");
      case "highschool":
        return tr("prereqGraph.kind.highschool");
      case "standing":
        return tr("prereqGraph.kind.standing");
      case "topic":
        return tr("prereqGraph.kind.topic");
      case "coursework":
        return tr("prereqGraph.kind.coursework");
      case "knowledge":
        return tr("prereqGraph.kind.knowledge");
      case "recommended":
        return tr("prereqGraph.kind.recommended");
    }
  }

  // Unclassified
  return tr("prereqGraph.kind.unclassified");
}

export function buildCreditSemanticLabel(node: CoursePrereqNode, tr: PrereqGraphTr): string {
  const credits = node.credits ?? 0;

  if (node.children?.length) {
    return tr("prereqGraph.semantic.creditTotal", { credits });
  }

  if (node.disciplineLevels?.length) {
    const desc = node.disciplineLevels
      .map((dl) => {
        const levels = dl.levels?.join(", ") ?? "";
        return levels ? `${dl.discipline} ${levels}` : dl.discipline;
      })
      .join("; ");
    return tr("prereqGraph.semantic.disciplineLevels", { credits, description: desc });
  }

  if (node.disciplines?.length && node.levels?.length) {
    return tr("prereqGraph.semantic.disciplineLevels", {
      credits,
      description: `${node.disciplines.join(", ")} ${node.levels.join(", ")}`,
    });
  }

  if (node.levels?.length) {
    return tr("prereqGraph.semantic.levels", { credits, levels: node.levels.join(", ") });
  }

  if (node.disciplines?.length) {
    return tr("prereqGraph.semantic.disciplines", {
      credits,
      disciplines: node.disciplines.join(", "),
    });
  }

  return tr("prereqGraph.semantic.creditTotal", { credits });
}

export function programLabel(node: CoursePrereqNode, tr: PrereqGraphTr): string {
  return tr("prereqGraph.programs", { programs: node.programs?.join(", ") ?? "" });
}

export function withProgramQualifier(
  label: string,
  node: CoursePrereqNode,
  tr: PrereqGraphTr,
): string {
  if (!node.programs?.length) return label;
  return tr("prereqGraph.programQualifier", {
    label,
    programs: node.programs.join(", "),
  });
}

export function buildNodeSummary(node: CoursePrereqNode, tr: PrereqGraphTr): string {
  let label: string;
  switch (node.type) {
    case "course":
      label = node.code ?? "";
      break;
    case "and_group":
      label = tr("prereqGraph.summary.andGroup", {
        children: (node.children ?? []).map((child) => buildNodeSummary(child, tr)).join("; "),
      });
      break;
    case "or_group":
      label = tr("prereqGraph.summary.orGroup", {
        children: (node.children ?? []).map((child) => buildNodeSummary(child, tr)).join("; "),
      });
      break;
    case "non_course":
      label =
        node.credits == null ? buildSemanticLabel(node, tr) : buildCreditSemanticLabel(node, tr);
      break;
    default:
      label = "";
  }
  return withProgramQualifier(label, node, tr);
}
