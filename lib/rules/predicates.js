const commaFilter = { filter: (token) => token.value === "," };
const includeCommentsFilter = { includeComments: true };

exports.unusedVarsPredicate = (problem, context) => {
  const { sourceCode } = context;

  const { node } = problem;
  const { parent } = node;

  // If parent is null just let the composed rule handle it
  if (parent == null) {
    return problem;
  }

  problem.fix = (fixer) => {
    if (!parent) {
      return null;
    }

    // case for ts interface
    if (
      node.type === "Identifier" &&
      (parent.type === "TSInterfaceDeclaration" ||
        parent.type === "TSEnumDeclaration" ||
        parent.type === "TSTypeAliasDeclaration")
    ) {
      return fixer.remove(parent);
    }

    // case for function, avoid arrow function expression with no declaration
    if (node.type === "Identifier" && parent.type === "FunctionDeclaration") {
      return fixer.remove(parent);
    }

    const grandParent = parent.parent;
    if (!grandParent) {
      return null;
    }

    // case for function params
    if (
      node.type === "Identifier" &&
      (parent.type === "FunctionDeclaration" ||
        parent.type === "ArrowFunctionExpression")
    ) {
      return fixer.remove(node);
    }

    // case for 'const cx = xx;'
    if (
      node.type === "Identifier" &&
      parent.type === "VariableDeclarator" &&
      grandParent.type === "VariableDeclaration"
    ) {
      return fixer.remove(parent.parent);
    }

    const ggrandParent = grandParent.parent;
    if (!ggrandParent) {
      return null;
    }

    // case for const [x, xx] = xxx;
    if (
      node.type === "Identifier" &&
      parent.type === "ArrayPattern" &&
      grandParent.type === "VariableDeclarator" &&
      ggrandParent.type === "VariableDeclaration"
    ) {
      let isAllSlibingNull = false;
      isAllSlibingNull = parent.elements.every((item) => {
        return item === node || item === null;
      });
      // 不考虑默认空的情况
      if (isAllSlibingNull) {
        return fixer.remove(ggrandParent);
      }
      return fixer.remove(node);
    }

    const gggrandParent = ggrandParent.parent;
    if (!gggrandParent) {
      return null;
    }

    // case for specical { x = xx }
    const isAssignmentObjectPattern =
      node.type === "Identifier" &&
      parent.type === "AssignmentPattern" &&
      grandParent.type === "Property" &&
      ggrandParent.type === "ObjectPattern";
    let _parent = parent,
      _grandParent = grandParent,
      _ggrandParent = ggrandParent,
      _gggrandParent = gggrandParent;
    if (isAssignmentObjectPattern) {
      _parent = grandParent;
      _grandParent = ggrandParent;
      _ggrandParent = gggrandParent;
      _gggrandParent = gggrandParent.parent;
    }

    // case for {x, xx}, add handle comma
    if (
      node.type === "Identifier" &&
      _parent.type === "Property" &&
      _grandParent.type === "ObjectPattern"
    ) {
      // case for VariableDeclaration, such as: const {x, xx} = xxx;
      const isVariableDeclaration =
        _ggrandParent.type === "VariableDeclarator" &&
        _gggrandParent.type === "VariableDeclaration";

      // case for other

      // delete all ObjectPattern or VariableDeclarator
      if (
        !_grandParent.properties.length ||
        _grandParent.properties.length === 1
      ) {
        // case for other
        if (isVariableDeclaration) {
          return fixer.remove(_gggrandParent);
        }
        return fixer.remove(_grandParent);
      }

      // delete Property and comma
      if (
        _grandParent.properties.findIndex((item) => item === _parent) !==
        _grandParent.properties.length - 1
      ) {
        const comma = sourceCode.getTokenAfter(_parent, commaFilter);
        return [fixer.remove(_parent), fixer.remove(comma)];
      }

      return fixer.remove(_parent);
    }

    return null;
  };
  return problem;
};

exports.unusedImportsPredicate = (problem, context) => {
  const { sourceCode } = context;

  const { node } = problem;
  const { parent } = node;

  // If parent is null just let the composed rule handle it
  if (parent == null) {
    return problem;
  }

  // Only handle these 3 cases.
  switch (parent.type) {
    case "ImportSpecifier":
    case "ImportDefaultSpecifier":
    case "ImportNamespaceSpecifier":
      break;
    default:
      return false;
  }

  problem.fix = (fixer) => {
    if (!parent) {
      return null;
    }
    const grandParent = parent.parent;

    if (!grandParent) {
      return null;
    }

    // Only one import
    if (grandParent.specifiers.length === 1) {
      const nextToken = sourceCode.getTokenAfter(
        grandParent,
        includeCommentsFilter
      );
      const newLinesBetween = nextToken
        ? nextToken.loc.start.line - grandParent.loc.start.line
        : 0;
      const endOfReplaceRange = nextToken
        ? nextToken.range[0]
        : grandParent.range[1];
      const count = Math.max(0, newLinesBetween - 1);

      return [
        fixer.remove(grandParent),
        fixer.replaceTextRange(
          [grandParent.range[1], endOfReplaceRange],
          "\n".repeat(count)
        ),
      ];
    }

    // Not last specifier
    if (parent !== grandParent.specifiers[grandParent.specifiers.length - 1]) {
      const comma = sourceCode.getTokenAfter(parent, commaFilter);
      const prevNode = sourceCode.getTokenBefore(parent);

      return [
        fixer.removeRange([prevNode.range[1], parent.range[0]]),
        fixer.remove(parent),
        fixer.remove(comma),
      ];
    }

    // Default export and a single normal left, ex. "import default, { package1 } from 'module';"
    if (
      grandParent.specifiers.filter(
        (specifier) => specifier.type === "ImportSpecifier"
      ).length === 1
    ) {
      const start = sourceCode.getTokenBefore(parent, commaFilter);
      const end = sourceCode.getTokenAfter(parent, {
        filter: (token) => token.value === "}",
      });

      return fixer.removeRange([start.range[0], end.range[1]]);
    }

    return fixer.removeRange([
      sourceCode.getTokenBefore(parent, commaFilter).range[0],
      parent.range[1],
    ]);
  };
  return problem;
};
