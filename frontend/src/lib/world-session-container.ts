import { MudConnection } from './connection';
import {
  createWorldSessionKey,
  createWorldSessionRegistry,
  type WorldSessionKey,
  type WorldSessionRegistry,
  type WorldSessionRegistryEntry,
} from './world-session-registry';
import {
  createWorldSessionDebugConsole,
  type WorldSessionDebugConsole,
} from './world-session-debug-console';

export interface WorldSessionContainer {
  key: WorldSessionKey;
  connection: MudConnection | null;
  debugConsole: WorldSessionDebugConsole;
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
}

export function createWorldSessionContainer(key: WorldSessionKey): WorldSessionContainer {
  return {
    key: createWorldSessionKey(key.worldId, key.characterId),
    connection: null,
    debugConsole: createWorldSessionDebugConsole(),
  };
}

export function createWorldSessionContainerRegistry(): WorldSessionContainerRegistry {
  const registry: WorldSessionRegistry<WorldSessionContainer> = createWorldSessionRegistry<WorldSessionContainer>({
    dispose: (container) => container.connection?.close(),
  });

  function getContainer(key: WorldSessionKey): WorldSessionContainer | null {
    return registry.get(key);
  }

  function ensureContainer(key: WorldSessionKey): WorldSessionContainer {
    return registry.ensure(key, createWorldSessionContainer);
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
        return registry.set(key, createWorldSessionContainer(key));
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
  };
}

export { createWorldSessionKey };
