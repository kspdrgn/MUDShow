import { SurfaceRegistry } from './surfaces/surface-registry.js';
import { createSurfaceTransportHub, type SurfaceTransportHub } from './surfaces/surface-transport.js';
import type { WorldPluginSurfaceContribution } from './world-plugin.js';
import type { WorldSessionKey } from './world-session-registry.js';
import type { WorldSurfacePayload } from './world-surface-protocol.js';

/**
 * Small, testable adapter around the app's existing host-neutral surface
 * registry. It deliberately does not introduce a second surface model.
 */
export interface WorldSurfaceHostPort {
  openSurface(
    pluginId: string,
    surfaceId: string,
    payload?: WorldSurfacePayload,
  ): string;
}

export interface WorldSurfaceHost {
  readonly registry: SurfaceRegistry;
  readonly transport: SurfaceTransportHub;
  register(pluginId: string, descriptor: WorldPluginSurfaceContribution): () => void;
  createPort(sessionKey: WorldSessionKey): WorldSurfaceHostPort;
  closeSession(sessionKey: WorldSessionKey): void;
}

export function createWorldSurfaceHost(): WorldSurfaceHost {
  const registry = new SurfaceRegistry();
  const transport = createSurfaceTransportHub();
  const owners = new Map<string, string>();

  return {
    registry,
    transport,
    register(pluginId, descriptor) {
      const existingOwner = owners.get(descriptor.id);
      if (existingOwner && existingOwner !== pluginId) throw new Error(`surface is already owned by ${existingOwner}`);
      if (registry.getRegistration(descriptor.id)) return () => {};
      owners.set(descriptor.id, pluginId);
      const unregister = registry.register({
        surfaceId: descriptor.id,
        kind: descriptor.kind,
        rendererId: descriptor.rendererId,
        defaultTitle: descriptor.defaultTitle,
        capabilities: descriptor.capabilities,
      });
      return () => {
        if (owners.get(descriptor.id) !== pluginId) return;
        unregister();
        owners.delete(descriptor.id);
      };
    },
    createPort(sessionKey) {
      return {
        openSurface(pluginId, surfaceId, payload) {
          const owner = owners.get(surfaceId);
          if (owner !== pluginId) throw new Error(`plugin does not own surface: ${surfaceId}`);
          const registration = registry.getRegistration(surfaceId);
          if (!registration) throw new Error(`surface is not registered: ${surfaceId}`);
          const instanceId = `${sessionKey.worldId}:${sessionKey.characterId ?? 'world'}:${surfaceId}`;
          if (!registry.getInstance(instanceId)) {
            registry.open({
              instanceId,
              surfaceId,
              title: typeof payload?.title === 'string' ? payload.title : registration.defaultTitle,
            });
          }
          transport.ensureSession(surfaceId, instanceId);
          return instanceId;
        },
      };
    },
    closeSession(sessionKey) {
      const prefix = `${sessionKey.worldId}:${sessionKey.characterId ?? 'world'}:`;
      registry.getSnapshot().instances
        .filter((instance) => instance.instanceId.startsWith(prefix))
        .forEach((instance) => {
          transport.deleteSession(instance.instanceId);
          registry.close(instance.instanceId);
        });
    },
  };
}
