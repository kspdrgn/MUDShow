import { getFuzzballStorageNodeLoadPath, type FuzzBallPropertyCacheStore, type FuzzBallPropertyTreeCache } from './storage-cache.js';
import type { TreeDataNode, TreeDataWindowModel } from '../components/tree-data/tree-data-view.js';
import {
  createWorldSessionKey,
  type WorldSessionContainerRegistry,
} from '../world-session-container.js';

export interface FuzzballStorageViewerState {
  sourceTabId: string;
  worldId: string;
  characterId: string;
  title: string;
  description?: string;
}

function renderSnapshotValue(snapshot: {
  value: string | null;
  isValueLoaded: boolean;
}): string {
  const value = snapshot.isValueLoaded
    ? snapshot.value ?? 'no value'
    : 'unloaded';

  return value;
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
    title: snapshot.name,
    subtitle: renderSnapshotValue(snapshot),
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
  storageCache: FuzzBallPropertyCacheStore,
  state: FuzzballStorageViewerState,
  nodePath: string,
  worldSessionContainers: WorldSessionContainerRegistry | null = null,
): void {
  if (!state.sourceTabId || !worldSessionContainers) {
    return;
  }

  const requestPath = getFuzzballStorageNodeLoadPath(storageCache, state, nodePath);
  const cache = storageCache.getSessionCache(state.worldId, state.characterId);
  if (requestPath === nodePath || requestPath === `${nodePath}/` || nodePath === '/') {
    if (!cache.beginChildrenLoad(nodePath)) {
      return;
    }
  }
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

export interface FuzzballStorageViewerService {
  createState(
    sourceTabId: string,
    worldId: string,
    characterId: string,
    title: string,
    description?: string,
  ): FuzzballStorageViewerState;
  requestNodeLoad(state: FuzzballStorageViewerState, nodePath: string): void;
  buildModel(state: FuzzballStorageViewerState): TreeDataWindowModel;
  hasData(state: FuzzballStorageViewerState): boolean;
  getSnapshot(state: FuzzballStorageViewerState, path: string): ReturnType<FuzzBallPropertyTreeCache['getSnapshot']>;
  subscribe(listener: () => void): () => void;
}

export function buildFuzzballStorageViewerModel(
  storageCache: FuzzBallPropertyCacheStore,
  state: FuzzballStorageViewerState,
): TreeDataWindowModel {
  const cache = storageCache.getSessionCache(state.worldId, state.characterId);
  const root = buildTreeNode(cache, '/') ?? {
    id: '/',
    title: '/',
    subtitle: 'unloaded',
    badge: 'dir',
    kind: 'branch',
    valueState: 'unknown',
    childrenState: 'unknown',
  };

  return {
    title: state.title,
    description: state.description,
    display: {
      selectedSummary: 'preview',
      badgePlacement: 'inline',
    },
    root,
  };
}

export function createFuzzballStorageViewerService(
  worldSessionContainers: WorldSessionContainerRegistry,
  storageCache: FuzzBallPropertyCacheStore,
): FuzzballStorageViewerService {
  return {
    createState: createFuzzballStorageViewerState,
    requestNodeLoad: (state, nodePath) => requestFuzzballStorageNodeLoad(storageCache, state, nodePath, worldSessionContainers),
    buildModel: (state) => buildFuzzballStorageViewerModel(storageCache, state),
    hasData: (state) => storageCache.getSessionCache(state.worldId, state.characterId).hasData(),
    getSnapshot: (state, path) => storageCache.getSessionCache(state.worldId, state.characterId).getSnapshot(path),
    subscribe: (listener) => storageCache.subscribe(listener),
  };
}
