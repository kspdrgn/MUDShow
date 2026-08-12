export type TreeDataNodeKind = 'branch' | 'leaf';
export type TreeDataNodeState = 'unknown' | 'loading' | 'loaded' | 'missing';

export interface TreeDataNode {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  kind: TreeDataNodeKind;
  valueState: TreeDataNodeState;
  childrenState: TreeDataNodeState;
  expanded?: boolean;
  children?: TreeDataNode[];
}

export interface TreeDataWindowModel {
  title: string;
  description?: string;
  root: TreeDataNode;
}

export interface TreeDataNodePatch {
  title?: string;
  subtitle?: string;
  badge?: string;
  kind?: TreeDataNodeKind;
  valueState?: TreeDataNodeState;
  childrenState?: TreeDataNodeState;
  expanded?: boolean | null;
  children?: TreeDataNode[] | null;
}

export interface TreeDataVisibleNode {
  node: TreeDataNode;
  depth: number;
  hasChildren: boolean;
}

export function flattenVisibleTreeDataNodes(root: TreeDataNode): TreeDataVisibleNode[] {
  const rows: TreeDataVisibleNode[] = [];

  function visit(node: TreeDataNode, depth: number): void {
    rows.push({
      node,
      depth,
      hasChildren: node.kind === 'branch' && node.childrenState !== 'missing',
    });

    if (!node.expanded) {
      return;
    }

    for (const child of node.children ?? []) {
      visit(child, depth + 1);
    }
  }

  visit(root, 0);
  return rows;
}

export function toggleTreeDataNodeExpansion(root: TreeDataNode, nodeId: string): TreeDataNode {
  return updateTreeDataNode(root, nodeId, (node) => {
    if (node.kind !== 'branch') {
      return node;
    }

    return {
      ...node,
      expanded: !node.expanded,
    };
  });
}

export function setTreeDataNodeExpansion(root: TreeDataNode, nodeId: string, expanded: boolean): TreeDataNode {
  return updateTreeDataNode(root, nodeId, (node) => {
    if (node.kind !== 'branch') {
      return node;
    }

    return {
      ...node,
      expanded,
    };
  });
}

export function setTreeDataDescendantsExpansion(root: TreeDataNode, expanded: boolean): TreeDataNode {
  return {
    ...root,
    expanded: true,
    children: root.children?.map((child) => setTreeDataNodeExpansionRecursive(child, expanded)) ?? [],
  };
}

export function findTreeDataNode(root: TreeDataNode, nodeId: string): TreeDataNode | null {
  if (root.id === nodeId) {
    return root;
  }

  for (const child of root.children ?? []) {
    const match = findTreeDataNode(child, nodeId);
    if (match) {
      return match;
    }
  }

  return null;
}

export function applyTreeDataNodePatch(
  root: TreeDataNode,
  nodeId: string,
  patch: TreeDataNodePatch,
): TreeDataNode {
  return updateTreeDataNode(root, nodeId, (node) => {
    const nextNode: TreeDataNode = {
      ...node,
      ...patch,
    };

    if (patch.expanded === null) {
      delete nextNode.expanded;
    }

    if (patch.children === null) {
      delete nextNode.children;
    }

    return nextNode;
  });
}

function setTreeDataNodeExpansionRecursive(node: TreeDataNode, expanded: boolean): TreeDataNode {
  const nextChildren = node.children?.map((child) => setTreeDataNodeExpansionRecursive(child, expanded)) ?? [];

  if (nextChildren.length === 0) {
    return {
      ...node,
      expanded: false,
      children: nextChildren,
    };
  }

  return {
    ...node,
    expanded,
    children: nextChildren,
  };
}

export function updateTreeDataNode(
  root: TreeDataNode,
  nodeId: string,
  updater: (node: TreeDataNode) => TreeDataNode,
): TreeDataNode {
  if (root.id === nodeId) {
    return updater(root);
  }

  const nextChildren = root.children?.map((child) => updateTreeDataNode(child, nodeId, updater)) ?? [];
  const changed = nextChildren.some((child, index) => child !== root.children?.[index]);

  if (!changed) {
    return root;
  }

  return {
    ...root,
    children: nextChildren,
  };
}
