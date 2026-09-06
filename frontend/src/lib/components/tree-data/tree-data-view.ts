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
  children?: TreeDataNode[];
}

export interface TreeDataWindowViewState {
  selectedNodeId: string | null;
  expandedNodeIds: string[];
}

export interface TreeDataWindowDisplayOptions {
  selectedSummary: 'title' | 'preview';
  badgePlacement: 'inline' | 'trailing';
}

export interface TreeDataWindowModel {
  title: string;
  description?: string;
  display?: TreeDataWindowDisplayOptions;
  root: TreeDataNode;
}

export interface TreeDataNodePatch {
  title?: string;
  subtitle?: string;
  badge?: string;
  kind?: TreeDataNodeKind;
  valueState?: TreeDataNodeState;
  childrenState?: TreeDataNodeState;
  children?: TreeDataNode[] | null;
}

export interface TreeDataVisibleNode {
  node: TreeDataNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
}

export function flattenVisibleTreeDataNodes(
  root: TreeDataNode,
  expandedNodeIds: ReadonlySet<string>,
): TreeDataVisibleNode[] {
  const rows: TreeDataVisibleNode[] = [];

  function visit(node: TreeDataNode, depth: number): void {
    const expanded = expandedNodeIds.has(node.id);
    rows.push({
      node,
      depth,
      hasChildren: node.kind === 'branch' && node.childrenState !== 'missing',
      expanded,
    });

    if (!expanded) {
      return;
    }

    for (const child of node.children ?? []) {
      visit(child, depth + 1);
    }
  }

  visit(root, 0);
  return rows;
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
      ...(patch.title !== undefined ? { title: patch.title } : {}),
      ...(patch.subtitle !== undefined ? { subtitle: patch.subtitle } : {}),
      ...(patch.badge !== undefined ? { badge: patch.badge } : {}),
      ...(patch.kind !== undefined ? { kind: patch.kind } : {}),
      ...(patch.valueState !== undefined ? { valueState: patch.valueState } : {}),
      ...(patch.childrenState !== undefined ? { childrenState: patch.childrenState } : {}),
      ...(patch.children !== undefined && patch.children !== null ? { children: patch.children } : {}),
    };

    if (patch.children === null) {
      delete nextNode.children;
    }

    return nextNode;
  });
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
