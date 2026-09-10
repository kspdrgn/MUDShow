import { supportsFuzzball } from '../world-capabilities.js';
import { createWorldPluginServiceKey, type WorldPlugin } from '../world-plugin.js';
import type { WorldSurfaceDescriptor } from '../world-surface-protocol.js';
import { createFuzzBallPropertyService, type FuzzBallPropertyService } from './property-service.js';

export const FUZZBALL_PLUGIN_ID = 'fuzzball';
export const FUZZBALL_STORAGE_SURFACE_ID = 'fuzzball-storage-viewer';
export const FUZZBALL_PROPERTY_SERVICE_KEY = createWorldPluginServiceKey<FuzzBallPropertyService>('fuzzball:property-service');

export const FUZZBALL_STORAGE_SURFACE: WorldSurfaceDescriptor = {
  protocolVersion: 1,
  surfaceId: FUZZBALL_STORAGE_SURFACE_ID,
  rendererId: 'tree-data',
  title: 'fuzzball storage viewer',
  capabilities: {
    canClose: true,
    canDock: true,
    canFloat: true,
    canPopOut: true,
    canPopIn: true,
    allowsMultipleInstances: true,
  },
};

export function createFuzzballPlugin(): WorldPlugin {
  return {
    id: FUZZBALL_PLUGIN_ID,
    label: 'FuzzBall',
    canActivate: ({ world }) => supportsFuzzball(world),
    createSessionContribution: ({ connection, host, services }) => {
      const properties = createFuzzBallPropertyService(connection);
      services.set(FUZZBALL_PROPERTY_SERVICE_KEY, properties);
      return {
        surfaces: [FUZZBALL_STORAGE_SURFACE],
        getActions: () => [{
          kind: 'button',
          id: FUZZBALL_STORAGE_SURFACE_ID,
          label: 'exa me=/',
          title: 'Open FuzzBall storage viewer',
          onClick: () => host.openSurface(FUZZBALL_PLUGIN_ID, FUZZBALL_STORAGE_SURFACE),
        } satisfies import('../world-session-action.js').WorldSessionAction],
        onIncomingLine: (line) => { properties.captureLine(line); },
        onDisconnected: () => properties.clear(),
        dispose: () => properties.clear(),
      };
    },
  };
}
