import type { TreeDataWindowModel } from '../components/tree-data/tree-data-view.js';
import { findTreeDataNode } from '../components/tree-data/tree-data-view.js';

export type TreeDataWindowCommand =
  | { type: 'nodeSelected'; nodeId: string }
  | { type: 'nodeExpansionToggled'; nodeId: string }
  | { type: 'expandAllRequested' }
  | { type: 'collapseAllRequested' };

export interface FuzzballStorageViewerState {
  sourceTabId: string;
  worldId: string;
  characterId: string;
  title: string;
  description?: string;
}

export interface FuzzballStorageViewerService {
  createState(sourceTabId: string, worldId: string, characterId: string, title: string, description?: string): FuzzballStorageViewerState;
  requestNodeLoad(state: FuzzballStorageViewerState, nodePath: string): void;
  buildModel(state: FuzzballStorageViewerState): TreeDataWindowModel;
}

export interface FuzzballStorageSurfaceWindowRecord {
  id: string;
  surfaceId: string;
  placement: string;
}

export interface FuzzballStorageSurfaceControllerDependencies {
  listWindows(): readonly FuzzballStorageSurfaceWindowRecord[];
  isSurfaceWindow(window: FuzzballStorageSurfaceWindowRecord): boolean;
  activateWindow(windowId: string): void;
  focusWindow(windowId: string): void;
  ensureSurface(sourceTabId: string): string;
  getViewerService(sourceTabId: string): FuzzballStorageViewerService | null;
  ensureTransport(windowId: string, surfaceId: string): void;
  rememberTransport(windowId: string, state: FuzzballStorageViewerState): void;
  requestInitialLoad(windowId: string, state: FuzzballStorageViewerState): void;
  registerTreeSurfaceInstance(
    windowId: string,
    modelProvider: () => TreeDataWindowModel,
    commandHandler: (command: TreeDataWindowCommand, model: TreeDataWindowModel) => void,
    sourceTabId?: string,
  ): void;
  disposeTreeSurfaceInstance(windowId: string): void;
  log(event: string, details: Record<string, unknown>): void;
  openSurface(options: {
    instanceId: string;
    surfaceId: string;
    title: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }): void;
}

export function createFuzzballStorageSurfaceController(
  dependencies: FuzzballStorageSurfaceControllerDependencies,
) {
  const states = new Map<string, FuzzballStorageViewerState>();

  function open(
    sourceTabId: string,
    worldId: string,
    characterId: string,
    title: string,
    description?: string,
  ): void {
    if (!worldId) {
      return;
    }

    const existingWindow = dependencies.listWindows().find((window) =>
      dependencies.isSurfaceWindow(window)
      && states.get(window.id)?.sourceTabId === sourceTabId,
    );
    if (existingWindow) {
      dependencies.activateWindow(existingWindow.id);
      dependencies.focusWindow(existingWindow.id);
      return;
    }

    const surfaceId = dependencies.ensureSurface(sourceTabId);
    const viewerService = dependencies.getViewerService(sourceTabId);
    if (!viewerService) {
      return;
    }

    const index = dependencies.listWindows().length;
    const id = `fuzzball-storage-window-${sourceTabId}`;
    const state = viewerService.createState(sourceTabId, worldId, characterId, title, description);
    states.set(id, state);
    dependencies.registerTreeSurfaceInstance(
      id,
      () => viewerService.buildModel(state),
      (command, model) => {
        if (command.type !== 'nodeExpansionToggled') {
          return;
        }

        const node = findTreeDataNode(model.root, command.nodeId);
        if (!node || node.kind !== 'branch' || node.childrenState !== 'unknown') {
          return;
        }

        dependencies.log('fuzzball load requested', {
          windowId: id,
          nodeId: command.nodeId,
          sourceTabId: state.sourceTabId,
        });
        viewerService.requestNodeLoad(state, command.nodeId);
      },
      sourceTabId,
    );
    dependencies.ensureTransport(id, surfaceId);
    dependencies.rememberTransport(id, state);
    dependencies.requestInitialLoad(id, state);
    dependencies.log('open fuzzball storage window', {
      windowId: id,
      surfaceId,
      kind: 'fuzzball',
      sourceTabId,
      worldId,
      characterId,
    });
    dependencies.openSurface({
      instanceId: id,
      surfaceId,
      title,
      position: { x: 120 + index * 28, y: 120 + index * 28 },
      size: { width: 720, height: 560 },
    });
    dependencies.activateWindow(id);
    dependencies.focusWindow(id);
  }

  function getState(windowId: string): FuzzballStorageViewerState | undefined {
    return states.get(windowId);
  }

  function getWindowIdsForSourceTab(sourceTabId: string): string[] {
    return [...states.entries()]
      .filter(([, state]) => state.sourceTabId === sourceTabId)
      .map(([windowId]) => windowId);
  }

  function dispose(windowId: string): void {
    states.delete(windowId);
    dependencies.disposeTreeSurfaceInstance(windowId);
  }

  return { open, getState, getWindowIdsForSourceTab, dispose };
}
