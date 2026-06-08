// @ts-check

function collectStaticIds(node, ops) {
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

export function staticTsIds(ts, node) {
  return collectStaticIds(node, {
    stringValue: (n) => (ts.isStringLiteralLike(n) ? n.text : null),
    parenthesized: (n) => (ts.isParenthesizedExpression(n) ? n.expression : null),
    conditionalBranches: (n) =>
      ts.isConditionalExpression(n) ? { whenTrue: n.whenTrue, whenFalse: n.whenFalse } : null,
  });
}

export function staticEstreeIds(node) {
  return collectStaticIds(node, {
    stringValue: (n) => {
      if (n.type === "Literal" && typeof n.value === "string") return n.value;
      if (n.type === "TemplateLiteral" && n.expressions.length === 0) {
        return n.quasis[0].value.cooked;
      }
      return null;
    },
    conditionalBranches: (n) =>
      n.type === "ConditionalExpression"
        ? { whenTrue: n.consequent, whenFalse: n.alternate }
        : null,
  });
}
