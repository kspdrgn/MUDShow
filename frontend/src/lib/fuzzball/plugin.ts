import { captureFuzzballWorldLine } from './capture.js';
import { createFuzzBallPropertyService, type FuzzBallPropertyService } from './property-service.js';
import { createFuzzballStorageViewerService, type FuzzballStorageViewerService } from './storage-viewer.js';
import type { WorldPlugin } from '../world-plugin.js';
import { supportsFuzzball } from '../world-capabilities.js';

export const FUZZBALL_PLUGIN_ID = 'fuzzball';
export const FUZZBALL_STORAGE_SURFACE_ID = 'fuzzball-storage-viewer';

export function createFuzzballPlugin(
  worldSessionContainers: import('../world-session-container.js').WorldSessionContainerRegistry,
): WorldPlugin {
  return {
    id: FUZZBALL_PLUGIN_ID,
    label: 'FuzzBall',
    canActivate: ({ world }) => supportsFuzzball(world),
    createSessionContribution: ({ world, character, services, host }) => {
      const propertyService = createFuzzBallPropertyService(
        world.id,
        character?.id ?? '',
        worldSessionContainers,
      );
      services.set<FuzzBallPropertyService>(FUZZBALL_PLUGIN_ID, propertyService);
      services.set<FuzzballStorageViewerService>(`${FUZZBALL_PLUGIN_ID}:storage-viewer`, createFuzzballStorageViewerService(worldSessionContainers));

      return {
        surfaces: [{
          id: FUZZBALL_STORAGE_SURFACE_ID,
          kind: 'builtin',
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
          onClick: () => host.invokeAction(FUZZBALL_PLUGIN_ID, 'open-storage-viewer'),
        }],
        onIncomingLine: (line) => {
          captureFuzzballWorldLine(world.id, character?.id ?? '', line);
        },
      };
    },
  };
}
