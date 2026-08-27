import { findTreeDataNode, type TreeDataNode, type TreeDataWindowModel, type TreeDataWindowViewState } from './tree-data-view';

export type { TreeDataWindowViewState } from './tree-data-view';

export type TreeDataWindowCommand =
  | { type: 'nodeSelected'; nodeId: string }
  | { type: 'nodeExpansionToggled'; nodeId: string }
  | { type: 'expandAllRequested' }
  | { type: 'collapseAllRequested' };

export function createInitialTreeDataWindowViewState(rootId: string): TreeDataWindowViewState {
  return {
    selectedNodeId: rootId,
    expandedNodeIds: [rootId],
  };
}

function collectTreeDataNodeIds(root: TreeDataNode): string[] {
  const ids: string[] = [];

  function visit(node: TreeDataNode): void {
    ids.push(node.id);

    for (const child of node.children ?? []) {
      visit(child);
    }
  }

  visit(root);
  return ids;
}

export function reconcileTreeDataWindowViewState(
  viewState: TreeDataWindowViewState,
  model: TreeDataWindowModel,
): TreeDataWindowViewState {
  const selectedNodeId =
    viewState.selectedNodeId && findTreeDataNode(model.root, viewState.selectedNodeId)
      ? viewState.selectedNodeId
      : model.root.id;
  const expandedNodeIds = [
    ...viewState.expandedNodeIds.filter((nodeId) => findTreeDataNode(model.root, nodeId)),
  ];

  return {
    selectedNodeId,
    expandedNodeIds: [...new Set(expandedNodeIds)],
  };
}

export function reduceTreeDataWindowViewState(
  viewState: TreeDataWindowViewState,
  command: TreeDataWindowCommand,
  model: TreeDataWindowModel,
): TreeDataWindowViewState {
  const current = reconcileTreeDataWindowViewState(viewState, model);

  switch (command.type) {
    case 'nodeSelected':
      if (!findTreeDataNode(model.root, command.nodeId)) {
        return current;
      }

      return {
        ...current,
        selectedNodeId: command.nodeId,
      };
    case 'nodeExpansionToggled': {
      if (!findTreeDataNode(model.root, command.nodeId)) {
        return current;
      }

      const expandedNodeIds = new Set(current.expandedNodeIds);
      if (expandedNodeIds.has(command.nodeId)) {
        expandedNodeIds.delete(command.nodeId);
      } else {
        expandedNodeIds.add(command.nodeId);
      }

      return {
        ...current,
        expandedNodeIds: [...expandedNodeIds],
      };
    }
    case 'expandAllRequested':
      return {
        ...current,
        expandedNodeIds: collectTreeDataNodeIds(model.root),
      };
    case 'collapseAllRequested':
      return {
        selectedNodeId: model.root.id,
        expandedNodeIds: [],
      };
    default:
      return current;
  }
}

export interface TreeDataViewControllerRegistry {
  get(windowId: string): TreeDataWindowViewState | null;
  ensure(windowId: string, rootId: string): TreeDataWindowViewState;
  update(windowId: string, model: TreeDataWindowModel, command: TreeDataWindowCommand): TreeDataWindowViewState;
  clear(windowId: string): boolean;
  clearAll(): void;
}

export function createTreeDataViewControllerRegistry(): TreeDataViewControllerRegistry {
  const viewStates = new Map<string, TreeDataWindowViewState>();

  return {
    get(windowId: string): TreeDataWindowViewState | null {
      return viewStates.get(windowId) ?? null;
    },
    ensure(windowId: string, rootId: string): TreeDataWindowViewState {
      const existing = viewStates.get(windowId);
      if (existing) {
        return existing;
      }

      const created = createInitialTreeDataWindowViewState(rootId);
      viewStates.set(windowId, created);
      return created;
    },
    update(windowId: string, model: TreeDataWindowModel, command: TreeDataWindowCommand): TreeDataWindowViewState {
      const current = viewStates.get(windowId) ?? createInitialTreeDataWindowViewState(model.root.id);
      const next = reduceTreeDataWindowViewState(current, command, model);
      viewStates.set(windowId, next);
      return next;
    },
    clear(windowId: string): boolean {
      return viewStates.delete(windowId);
    },
    clearAll(): void {
      viewStates.clear();
    },
  };
}
