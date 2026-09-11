import { captureFuzzballWorldLine } from './capture.js';
import { createFuzzBallPropertyService, type FuzzBallPropertyService } from './property-service.js';
import { createFuzzballStorageViewerService, type FuzzballStorageViewerService } from './storage-viewer.js';
import { createWorldPluginServiceKey, type WorldPlugin } from '../world-plugin.js';
import { supportsFuzzball } from '../world-capabilities.js';
import { fuzzballStorageCache } from './storage-cache.js';

export const FUZZBALL_PLUGIN_ID = 'fuzzball';
export const FUZZBALL_STORAGE_SURFACE_ID = 'fuzzball-storage-viewer';
export const FUZZBALL_PROPERTY_SERVICE_KEY = createWorldPluginServiceKey<FuzzBallPropertyService>(FUZZBALL_PLUGIN_ID);
export const FUZZBALL_STORAGE_VIEWER_SERVICE_KEY = createWorldPluginServiceKey<FuzzballStorageViewerService>(`${FUZZBALL_PLUGIN_ID}:storage-viewer`);

export function createFuzzballPlugin(
  worldSessionContainers: import('../world-session-container.js').WorldSessionContainerRegistry,
): WorldPlugin {
  return {
    id: FUZZBALL_PLUGIN_ID,
    label: 'FuzzBall',
    canActivate: ({ world }) => supportsFuzzball(world),
    createSessionContribution: ({ world, character, services, host, connection }) => {
      const propertyService = createFuzzBallPropertyService(connection);
      services.set(FUZZBALL_PROPERTY_SERVICE_KEY, propertyService);
      services.set(FUZZBALL_STORAGE_VIEWER_SERVICE_KEY, createFuzzballStorageViewerService(worldSessionContainers));

      return {
        surfaces: [{
          id: FUZZBALL_STORAGE_SURFACE_ID,
          kind: 'plugin',
          protocolVersion: 1,
          rendererId: 'tree-data',
          defaultTitle: 'fuzzball storage viewer',
          capabilities: {
            canClose: true,
            canDock: true,
            canFloat: true,
            canPopOut: true,
            canPopIn: true,
            isModal: false,
            allowsMultipleInstances: true,
          },
        }],
        getActions: () => [{
          kind: 'button',
          id: 'fuzzball-storage-viewer',
          label: 'exa me=/',
          title: 'Open fuzzball storage viewer',
          onClick: () => host.openSurface(FUZZBALL_PLUGIN_ID, FUZZBALL_STORAGE_SURFACE_ID, {
            worldId: world.id,
            characterId: character?.id ?? '',
            title: character?.name
              ? `${world.name} · ${character.name} storage`
              : `${world.name} storage`,
          }),
        }],
        onIncomingLine: (line) => {
          propertyService.captureLine(line);
          captureFuzzballWorldLine(world.id, character?.id ?? '', line);
        },
        onAttached: () => {
          // A recreated frontend session starts with an empty property cache.
          // Rebuild the root from the live world connection instead of relying
          // on transcript replay to reconstruct plugin state.
          propertyService.refresh('/');
        },
        dispose: () => {
          fuzzballStorageCache.clearSessionCache(world.id, character?.id ?? '');
        },
      };
    },
  };
}
