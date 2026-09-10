import type { WorldPluginSurfaceContribution } from '../world-plugin.js';
import type { WorldPluginServiceKey } from '../world-plugin.js';
import { FUZZBALL_PLUGIN_ID, FUZZBALL_STORAGE_SURFACE_ID } from './plugin.js';
import {
  createFuzzballStorageSurfaceController,
  type FuzzballStorageSurfaceControllerDependencies,
} from './storage-surface-controller.js';
import type { FuzzballStorageViewerService, FuzzballStorageViewerState } from './storage-viewer.js';
import { fuzzballStorageCache } from './storage-cache.js';
import { FUZZBALL_STORAGE_VIEWER_SERVICE_KEY } from './plugin.js';
import type { TreeDataWindowModel } from '../components/tree-data/tree-data-view.js';

export interface FuzzballSurfaceHostAdapterDependencies
  extends Omit<FuzzballStorageSurfaceControllerDependencies, 'ensureSurface' | 'getViewerService' | 'rememberTransport' | 'requestInitialLoad'> {
  getSurfaceContribution(sourceTabId: string, surfaceId: string): WorldPluginSurfaceContribution | null;
  getPluginService<T>(sourceTabId: string, key: WorldPluginServiceKey<T>): T | null;
  rememberTransportModel(windowId: string, model: TreeDataWindowModel): void;
  registerSurface(registration: {
    surfaceId: string;
    kind: 'builtin' | 'plugin';
    rendererId: string;
    defaultTitle: string;
    capabilities: WorldPluginSurfaceContribution['capabilities'];
  }): void;
  registerOpenHandler(
    pluginId: string,
    surfaceId: string,
    handler: (tabId: string, payload?: Readonly<Record<string, unknown>>) => void,
  ): void;
  registerStateDisposer(surfaceId: string, disposer: (instanceId: string) => void): void;
  registerSourceWindowProvider(surfaceId: string, provider: (sourceTabId: string) => readonly string[]): void;
  getWorldContext(tabId: string): {
    worldId: string;
    characterId: string;
    defaultTitle: string;
  } | null;
}

export function createFuzzballSurfaceHostAdapter(
  dependencies: FuzzballSurfaceHostAdapterDependencies,
) {
  function getViewerService(sourceTabId: string): FuzzballStorageViewerService | null {
    return dependencies.getPluginService(sourceTabId, FUZZBALL_STORAGE_VIEWER_SERVICE_KEY);
  }

  function ensureSurface(sourceTabId: string): string {
    const surface = dependencies.getSurfaceContribution(sourceTabId, FUZZBALL_STORAGE_SURFACE_ID);
    if (!surface || surface.id !== FUZZBALL_STORAGE_SURFACE_ID) {
      throw new Error(`surface ${FUZZBALL_STORAGE_SURFACE_ID} is not contributed by plugin ${FUZZBALL_PLUGIN_ID}`);
    }

    if (!getViewerService(sourceTabId)) {
      throw new Error(`viewer service is not available for plugin ${FUZZBALL_PLUGIN_ID}`);
    }

    dependencies.registerSurface({
      surfaceId: surface.id,
      kind: surface.kind,
      rendererId: surface.rendererId,
      defaultTitle: surface.defaultTitle,
      capabilities: surface.capabilities,
    });
    return surface.id;
  }

  const controller = createFuzzballStorageSurfaceController({
    ...dependencies,
    ensureSurface,
    getViewerService,
    rememberTransport: (windowId, state: FuzzballStorageViewerState) => {
      const viewerService = getViewerService(state.sourceTabId);
      if (viewerService) {
        dependencies.rememberTransportModel(windowId, viewerService.buildModel(state));
      }
    },
    requestInitialLoad: (windowId, state: FuzzballStorageViewerState) => {
      if (!state.sourceTabId) {
        return;
      }

      const cache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);
      if (cache.hasData() && cache.getSnapshot('/')?.areChildrenLoaded) {
        return;
      }

      dependencies.log('initial plugin surface load requested', {
        windowId,
        worldId: state.worldId,
        characterId: state.characterId,
        sourceTabId: state.sourceTabId,
      });
      getViewerService(state.sourceTabId)?.requestNodeLoad(state, '/');
    },
  });

  function restorePoppedOutWindow(windowId: string, title: string): boolean {
    const prefix = 'fuzzball-storage-window-';
    if (!windowId.startsWith(prefix)) {
      return false;
    }

    const sourceTabId = windowId.slice(prefix.length);
    const context = dependencies.getWorldContext(sourceTabId);
    if (!context) {
      return false;
    }

    try {
      ensureSurface(sourceTabId);
    } catch {
      return false;
    }

    return controller.restore(
      sourceTabId,
      context.worldId,
      context.characterId,
      title,
    ) !== null;
  }

  dependencies.registerOpenHandler(
    FUZZBALL_PLUGIN_ID,
    FUZZBALL_STORAGE_SURFACE_ID,
    (tabId, payload) => {
      const context = dependencies.getWorldContext(tabId);
      if (!context) {
        return;
      }

      const worldId = typeof payload?.worldId === 'string' ? payload.worldId : context.worldId;
      const characterId = typeof payload?.characterId === 'string' ? payload.characterId : context.characterId;
      const title = typeof payload?.title === 'string' ? payload.title : context.defaultTitle;
      controller.open(tabId, worldId, characterId, title);
    },
  );
  dependencies.registerStateDisposer(FUZZBALL_STORAGE_SURFACE_ID, controller.dispose);
  dependencies.registerSourceWindowProvider(
    FUZZBALL_STORAGE_SURFACE_ID,
    controller.getWindowIdsForSourceTab,
  );

  return {
    ...controller,
    restorePoppedOutWindow,
    subscribeInvalidation(listener: () => void): () => void {
      return fuzzballStorageCache.subscribe(listener);
    },
  };
}
