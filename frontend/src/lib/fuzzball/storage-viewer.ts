import { fuzzballStorageCache, getFuzzballStorageNodeLoadPath } from './storage-cache';
import type { FuzzBallPropertyTreeCache } from './storage-cache';
import type { TreeDataNode, TreeDataWindowModel } from '../components/tree-data/tree-data-view.js';
import {
  createWorldSessionKey,
  type WorldSessionContainerRegistry,
} from '../world-session-container';

export interface FuzzballStorageViewerState {
  sourceTabId: string;
  worldId: string;
  characterId: string;
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

  const children = snapshot.areChildrenLoaded
    ? cache.getChildren(snapshot.path)
      .map((child): TreeDataNode | null => buildTreeNode(cache, child.path))
      .filter((child: TreeDataNode | null): child is TreeDataNode => child !== null)
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
    title,
    description,
  };
}

export function requestFuzzballStorageNodeLoad(
  state: FuzzballStorageViewerState,
  nodePath: string,
  worldSessionContainers: WorldSessionContainerRegistry | null = null,
): void {
  if (!state.sourceTabId || !worldSessionContainers) {
    return;
  }

  const requestPath = getFuzzballStorageNodeLoadPath(state, nodePath);
  const command = `examine me=${requestPath}\r\n`;
  console.debug('[fuzzball storage] requesting node load', {
    sourceTabId: state.sourceTabId,
    worldId: state.worldId,
    characterId: state.characterId,
    nodePath,
    requestPath,
    command: command.trimEnd(),
  });
  worldSessionContainers.connection
    .get(createWorldSessionKey(state.worldId, state.characterId))
    ?.send(command);
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
  };

  return {
    title: state.title,
    description: state.description,
    root,
  };
}
