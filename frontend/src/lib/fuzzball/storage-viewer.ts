import { fuzzballStorageCache } from './storage-cache.js';
import type { FuzzBallPropertyTreeCache } from './storage-cache.js';
import type { TreeDataNode, TreeDataWindowModel } from '../components/tree-data/tree-data-view.js';

export interface FuzzballStorageViewerState {
  sourceTabId: string;
  worldId: string;
  characterId: string;
  selectedNodeId: string;
  title: string;
  description?: string;
}

function renderSnapshotSubtitle(snapshot: {
  name: string;
  type: string;
  value: string | null;
  isValueLoaded: boolean;
}): string {
  const value = snapshot.isValueLoaded
    ? snapshot.value ?? 'no value'
    : 'unloaded';

  return `${snapshot.name} · ${snapshot.type} · ${value}`;
}

function buildTreeNode(cache: FuzzBallPropertyTreeCache, path: string): TreeDataNode | null {
  const snapshot = cache.getSnapshot(path);

  if (!snapshot) {
    return null;
  }

  const children = snapshot.isExpanded
    ? snapshot.areChildrenLoaded
      ? cache.getChildren(snapshot.path)
        .map((child): TreeDataNode | null => buildTreeNode(cache, child.path))
        .filter((child: TreeDataNode | null): child is TreeDataNode => child !== null)
      : undefined
    : undefined;

  return {
    id: snapshot.path,
    title: snapshot.path,
    subtitle: renderSnapshotSubtitle(snapshot),
    badge: snapshot.type,
    kind: snapshot.hasChildren ? 'branch' : 'leaf',
    valueState: snapshot.isValueLoaded ? 'loaded' : 'unknown',
    childrenState: snapshot.hasChildren
      ? (snapshot.areChildrenLoaded ? 'loaded' : 'unknown')
      : 'missing',
    expanded: snapshot.hasChildren ? snapshot.isExpanded : false,
    children,
  };
}

export function createFuzzballStorageViewerState(
  sourceTabId: string,
  worldId: string,
  characterId: string,
  title: string,
  description?: string,
): FuzzballStorageViewerState {
  return {
    sourceTabId,
    worldId,
    characterId,
    selectedNodeId: '/',
    title,
    description,
  };
}

export function updateFuzzballStorageViewerSelection(
  state: FuzzballStorageViewerState,
  nodeId: string,
): FuzzballStorageViewerState {
  return {
    ...state,
    selectedNodeId: nodeId,
  };
}

export function buildFuzzballStorageViewerModel(state: FuzzballStorageViewerState): TreeDataWindowModel {
  const cache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);
  const root = buildTreeNode(cache, '/') ?? {
    id: '/',
    title: '/',
    subtitle: '/ · dir · unloaded',
    badge: 'dir',
    kind: 'branch',
    valueState: 'unknown',
    childrenState: 'missing',
    expanded: false,
  };

  return {
    title: state.title,
    description: state.description,
    root,
  };
}

function walkKnownTreePaths(
  cache: FuzzBallPropertyTreeCache,
  path: string,
  visit: (nodePath: string) => void,
): void {
  const snapshot = cache.getSnapshot(path);

  if (!snapshot) {
    return;
  }

  visit(snapshot.path);

  for (const child of cache.getChildren(snapshot.path)) {
    if (child.hasChildren) {
      walkKnownTreePaths(cache, child.path, visit);
    }
  }
}

export function toggleFuzzballStorageViewerNode(
  state: FuzzballStorageViewerState,
  nodeId: string,
  onRequestNodeLoad: ((nodePath: string) => void) | null = null,
): void {
  const cache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);
  const node = cache.getSnapshot(nodeId);

  if (node && !node.hasChildren) {
    return;
  }

  if (node?.isExpanded) {
    cache.markCollapsed(nodeId);
    return;
  }

  if (!node || !node.isValueLoaded || !node.areChildrenLoaded) {
    onRequestNodeLoad?.(nodeId);
  }

  cache.markExpanded(nodeId);
}

export function expandAllFuzzballStorageViewerNodes(state: FuzzballStorageViewerState): void {
  const cache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);
  walkKnownTreePaths(cache, '/', (path) => {
    const node = cache.getSnapshot(path);
    if (node?.hasChildren) {
      cache.markExpanded(path);
    }
  });
}

export function collapseAllFuzzballStorageViewerNodes(state: FuzzballStorageViewerState): void {
  const cache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);
  walkKnownTreePaths(cache, '/', (path) => {
    const node = cache.getSnapshot(path);
    if (node?.hasChildren) {
      cache.markCollapsed(path);
    }
  });
}
