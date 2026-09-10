import { MudConnection } from './connection.js';
import {
  createWorldSessionKey,
  createWorldSessionRegistry,
  type WorldSessionKey,
  type WorldSessionRegistry,
  type WorldSessionRegistryEntry,
} from './world-session-registry.js';
import {
  createWorldSessionDebugConsole,
  type WorldSessionDebugConsole,
} from './world-session-debug-console.js';
import type { WorldPluginSession } from './world-plugin-registry.js';
import type { WorldPluginServiceBag, WorldPluginServiceKey } from './world-plugin.js';
import {
  createWorldSessionServices,
  type WorldSessionNotesService,
  type WorldSessionStoragePort,
  type WorldSessionTranscriptService,
} from './world-session-services.js';

export interface WorldSessionContainer {
  key: WorldSessionKey;
  connection: MudConnection | null;
  debugConsole: WorldSessionDebugConsole;
  pluginSession: WorldPluginSession | null;
  pluginSessionServices: WorldPluginServiceBag;
  notes: WorldSessionNotesService;
  transcript: WorldSessionTranscriptService;
}

export interface WorldSessionContainerRegistry {
  container: {
    get(key: WorldSessionKey): WorldSessionContainer | null;
    has(key: WorldSessionKey): boolean;
    ensure(key: WorldSessionKey): WorldSessionContainer;
    set(key: WorldSessionKey): WorldSessionContainer;
    delete(key: WorldSessionKey): boolean;
    entries(): Array<WorldSessionRegistryEntry<WorldSessionContainer>>;
    clear(): void;
  };
  connection: {
    get(key: WorldSessionKey): MudConnection | null;
    ensure(key: WorldSessionKey, connectionId?: string | null): MudConnection | null;
  };
  debugConsole: {
    get(key: WorldSessionKey): WorldSessionDebugConsole | null;
    ensure(key: WorldSessionKey): WorldSessionDebugConsole;
  };
  notes: {
    get(key: WorldSessionKey): WorldSessionNotesService | null;
    ensure(key: WorldSessionKey): WorldSessionNotesService;
  };
  transcript: {
    get(key: WorldSessionKey): WorldSessionTranscriptService | null;
    ensure(key: WorldSessionKey): WorldSessionTranscriptService;
  };
}

export function createWorldSessionContainer(
  key: WorldSessionKey,
  storage?: WorldSessionStoragePort,
): WorldSessionContainer {
  const services = createWorldSessionServices(key, storage);
  return {
    key: createWorldSessionKey(key.worldId, key.characterId),
    connection: null,
    debugConsole: createWorldSessionDebugConsole(),
    pluginSession: null,
    pluginSessionServices: createWorldPluginServiceBag(),
    notes: services.notes,
    transcript: services.transcript,
  };
}

function createWorldPluginServiceBag(): WorldPluginServiceBag {
  const services = new Map<string, unknown>();
  return {
    get<T>(key: WorldPluginServiceKey<T>): T | null {
      return (services.get(key.id) as T | undefined) ?? null;
    },
    set<T>(key: WorldPluginServiceKey<T>, service: T): void {
      services.set(key.id, service);
    },
  };
}

export interface WorldSessionContainerRegistryOptions {
  storage?: WorldSessionStoragePort;
}

export function createWorldSessionContainerRegistry({
  storage,
}: WorldSessionContainerRegistryOptions = {}): WorldSessionContainerRegistry {
  const registry: WorldSessionRegistry<WorldSessionContainer> = createWorldSessionRegistry<WorldSessionContainer>({
    dispose: async (container: WorldSessionContainer) => {
      await container.pluginSession?.dispose();
      container.notes.dispose();
      container.transcript.dispose();
      await container.connection?.close();
    },
  });

  function getContainer(key: WorldSessionKey): WorldSessionContainer | null {
    return registry.get(key);
  }

  function ensureContainer(key: WorldSessionKey): WorldSessionContainer {
    return registry.ensure(key, (nextKey) => createWorldSessionContainer(nextKey, storage));
  }

  function ensureConnection(container: WorldSessionContainer, connectionId?: string | null): MudConnection | null {
    if (!container.connection && !connectionId) {
      return null;
    }

    if (!container.connection) {
      container.connection = new MudConnection(connectionId as string, container.debugConsole);
      return container.connection;
    }

    return container.connection;
  }

  return {
    container: {
      get: registry.get,
      has: registry.has,
      ensure(key: WorldSessionKey): WorldSessionContainer {
        return ensureContainer(key);
      },
      set(key: WorldSessionKey): WorldSessionContainer {
        return registry.set(key, createWorldSessionContainer(key, storage));
      },
      delete: registry.delete,
      entries: registry.entries,
      clear(): void {
        registry.clear();
      },
    },
    connection: {
      get(key: WorldSessionKey): MudConnection | null {
        return getContainer(key)?.connection ?? null;
      },
      ensure(key: WorldSessionKey, connectionId: string | null = null): MudConnection | null {
        return ensureConnection(ensureContainer(key), connectionId);
      },
    },
    debugConsole: {
      get(key: WorldSessionKey): WorldSessionDebugConsole | null {
        return getContainer(key)?.debugConsole ?? null;
      },
      ensure(key: WorldSessionKey): WorldSessionDebugConsole {
        return ensureContainer(key).debugConsole;
      },
    },
    notes: {
      get(key: WorldSessionKey): WorldSessionNotesService | null {
        return getContainer(key)?.notes ?? null;
      },
      ensure(key: WorldSessionKey): WorldSessionNotesService {
        return ensureContainer(key).notes;
      },
    },
    transcript: {
      get(key: WorldSessionKey): WorldSessionTranscriptService | null {
        return getContainer(key)?.transcript ?? null;
      },
      ensure(key: WorldSessionKey): WorldSessionTranscriptService {
        return ensureContainer(key).transcript;
      },
    },
  };
}

export { createWorldSessionKey };
