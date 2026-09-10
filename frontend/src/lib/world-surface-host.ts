import { SurfaceRegistry } from './surfaces/surface-registry.js';
import { createSurfaceTransportHub, type SurfaceTransportHub } from './surfaces/surface-transport.js';
import type { WorldSurfaceHostPort, WorldSessionKey } from './world-plugin.js';
import type { WorldSurfaceDescriptor } from './world-surface-protocol.js';

export interface WorldSurfaceHost {
  readonly registry: SurfaceRegistry;
  readonly transport: SurfaceTransportHub;
  register(pluginId: string, descriptor: WorldSurfaceDescriptor): () => void;
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
      const existingOwner = owners.get(descriptor.surfaceId);
      if (existingOwner && existingOwner !== pluginId) throw new Error(`surface is already owned by ${existingOwner}`);
      if (registry.getRegistration(descriptor.surfaceId)) return () => {};
      owners.set(descriptor.surfaceId, pluginId);
      return registry.register(descriptor);
    },
    createPort(sessionKey) {
      return {
        openSurface(pluginId, descriptor, _payload) {
          const owner = owners.get(descriptor.surfaceId);
          if (owner !== pluginId) throw new Error(`plugin does not own surface: ${descriptor.surfaceId}`);
          if (!registry.getRegistration(descriptor.surfaceId)) throw new Error(`surface is not registered: ${descriptor.surfaceId}`);
          const instanceId = `${sessionKey.worldId}:${sessionKey.characterId ?? 'world'}:${descriptor.surfaceId}`;
          if (!registry.get(instanceId)) {
            registry.open(instanceId, descriptor.surfaceId);
          }
          transport.ensureSession(descriptor.surfaceId, instanceId);
          return instanceId;
        },
      };
    },
    closeSession(sessionKey) {
      const prefix = `${sessionKey.worldId}:${sessionKey.characterId ?? 'world'}:`;
      registry.getSnapshot().instances
        .filter((instance) => instance.instanceId.startsWith(prefix))
        .forEach((instance) => {
          transport.deleteSession(instance.instanceId, 'owning world session disposed');
          registry.close(instance.instanceId);
        });
    },
  };
}
