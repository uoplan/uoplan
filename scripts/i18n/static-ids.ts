import type ts from "typescript";

/** Adapter that reads the shape of one AST node, abstracting TS vs ESTree nodes. */
interface NodeOps<T> {
  stringValue: (node: T) => string | null;
  parenthesized?: (node: T) => T | null;
  conditionalBranches: (node: T) => { whenTrue: T; whenFalse: T } | null;
}

function collectStaticIds<T>(node: T | null | undefined, ops: NodeOps<T>): string[] {
  if (!node) return [];
  const value = ops.stringValue(node);
  if (typeof value === "string") return [value];

  const inner = ops.parenthesized?.(node);
  if (inner) return collectStaticIds(inner, ops);

  const branches = ops.conditionalBranches(node);
  if (branches) {
    const whenTrue = collectStaticIds(branches.whenTrue, ops);
    const whenFalse = collectStaticIds(branches.whenFalse, ops);
    if (whenTrue.length > 0 && whenFalse.length > 0) return [...whenTrue, ...whenFalse];
  }
  return [];
}

export function staticTsIds(tsApi: typeof ts, node: ts.Node | undefined): string[] {
  return collectStaticIds<ts.Node>(node, {
    stringValue: (n) => (tsApi.isStringLiteralLike(n) ? n.text : null),
    parenthesized: (n) => (tsApi.isParenthesizedExpression(n) ? n.expression : null),
    conditionalBranches: (n) =>
      tsApi.isConditionalExpression(n) ? { whenTrue: n.whenTrue, whenFalse: n.whenFalse } : null,
  });
}

/** Minimal ESTree node shape consumed from the oxlint plugin's AST. */
export interface EstreeNode {
  type: string;
  value?: unknown;
  expressions?: readonly unknown[];
  quasis?: readonly { value: { cooked?: string | null } }[];
  consequent?: EstreeNode | null;
  alternate?: EstreeNode | null;
}

export function staticEstreeIds(node: EstreeNode | null | undefined): string[] {
  return collectStaticIds<EstreeNode>(node, {
    stringValue: (n) => {
      if (n.type === "Literal" && typeof n.value === "string") return n.value;
      if (n.type === "TemplateLiteral" && n.expressions?.length === 0) {
        return n.quasis?.[0]?.value.cooked ?? null;
      }
      return null;
    },
    conditionalBranches: (n) =>
      n.type === "ConditionalExpression" && n.consequent && n.alternate
        ? { whenTrue: n.consequent, whenFalse: n.alternate }
        : null,
  });
}
