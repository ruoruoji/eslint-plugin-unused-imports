const commaFilter = { filter: (token) => token.value === "," };
const includeCommentsFilter = { includeComments: true };

exports.unusedVarsPredicate = (problem, context) => {
  const { sourceCode, options } = context;

  if (options?.[0]?.autoFix === false) {
    return problem;
  }

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

    let _node, _parent, _grandParent, _ggrandParent, _gggrandParent;

    // case for ts
    if (
      parent.type === "TSInterfaceDeclaration" ||
      parent.type === "TSEnumDeclaration" ||
      parent.type === "TSTypeAliasDeclaration" ||
      parent.type === "TSTypeParameter" ||
      parent.type === "TSTypeParameterDeclaration"
    ) {
      if (
        parent.type === "TSTypeParameter" ||
        parent.type === "TSTypeParameterDeclaration"
      ) {
        // todo
        return null;
      }
      return fixer.remove(parent);
    }

    _node = node;
    _parent = parent;
    if (parent.type === "RestElement") {
      _node = parent;
      _parent = parent.parent;
    }
    // case for function
    if (
      _parent.type === "FunctionDeclaration" ||
      _parent.type === "FunctionExpression" ||
      _parent.type === "ArrowFunctionExpression"
    ) {
      // remove function, avoid arrow function expression with no declaration
      if (node === _parent.id) {
        return fixer.remove(_parent);
      }

      // case for function params, include (...sq) => {}
      const index = _parent.params.findIndex((item) => item === _node);
      if (index === _parent.params.length - 1) {
        const comma = sourceCode.getTokenBefore(_node, commaFilter);
        // although last remove was called but the next call the reference is not changed immediately
        _parent.params.splice(index, 1);
        if (index === 0) {
          return fixer.remove(_node);
        }
        return [fixer.remove(_node), fixer.remove(comma)];
      }
      return null;
    }

    const grandParent = parent.parent;
    if (!grandParent) {
      return null;
    }

    // case for 'const cx = xx;'
    if (
      parent.type === "VariableDeclarator" &&
      grandParent.type === "VariableDeclaration"
    ) {
      return fixer.remove(parent.parent);
    }

    const ggrandParent = grandParent.parent;
    if (!ggrandParent) {
      return null;
    }

    _node = node;
    _parent = parent;
    _grandParent = grandParent;
    _ggrandParent = ggrandParent;
    if (parent.type === "RestElement") {
      _node = parent;
      _parent = grandParent;
      _grandParent = ggrandParent;
      _ggrandParent = ggrandParent.parent;
    }
    // case for const [x, xx] = xxx;
    if (
      _parent.type === "ArrayPattern" &&
      _grandParent.type === "VariableDeclarator" &&
      _ggrandParent.type === "VariableDeclaration"
    ) {
      let isAllSiblingNull = false;
      isAllSiblingNull = _parent.elements.every((item) => {
        return item === _node || item === null;
      });

      // 不考虑默认空的情况
      if (isAllSiblingNull) {
        return fixer.remove(_ggrandParent);
      }

      const index = _parent.elements.findIndex((item) => item === _node);
      // although last remove was called but the next call the reference is not changed immediately
      _parent.elements.splice(index, 1);
      return fixer.remove(_node);
    }

    const gggrandParent = ggrandParent.parent;
    if (!gggrandParent) {
      return null;
    }

    _parent = parent;
    _grandParent = grandParent;
    _ggrandParent = ggrandParent;
    _gggrandParent = gggrandParent;
    // case for special { x = xx }
    if (parent.type === "AssignmentPattern") {
      _parent = grandParent;
      _grandParent = ggrandParent;
      _ggrandParent = gggrandParent;
      _gggrandParent = gggrandParent.parent;
    }
    // case for {x, xx, ...xxx}
    if (
      (_parent.type === "Property" || _parent.type === "RestElement") &&
      _grandParent.type === "ObjectPattern"
    ) {
      // case for VariableDeclaration, such as: const {x, xx} = xxx;
      const isVariableDeclaration =
        _ggrandParent.type === "VariableDeclarator" &&
        _gggrandParent.type === "VariableDeclaration";

      const isFunctionDeclaration =
        _ggrandParent.type === "FunctionDeclaration" ||
        _ggrandParent.type === "FunctionExpression" ||
        _ggrandParent.type === "ArrowFunctionExpression";

      // delete all ObjectPattern or VariableDeclarator
      if (_grandParent.properties.length === 1) {
        // case for other
        if (isVariableDeclaration) {
          return fixer.remove(_gggrandParent);
        }
        if (isFunctionDeclaration) {
          return fixer.remove(_parent);
        }
        return fixer.remove(_grandParent);
      }

      // delete Property and comma
      const index = _grandParent.properties.findIndex(
        (item) => item === _parent
      );
      // although last remove was called but the next call the reference is not changed immediately
      _grandParent.properties.splice(index, 1);

      const comma =
        index === 0
          ? sourceCode.getTokenAfter(_parent, commaFilter)
          : sourceCode.getTokenBefore(_parent, commaFilter);
      return [fixer.remove(_parent), fixer.remove(comma)];
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
