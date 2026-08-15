import { MudConnection } from './connection';
import {
  createWorldSessionKey,
  createWorldSessionRegistry,
  type WorldSessionKey,
  type WorldSessionRegistry,
  type WorldSessionRegistryEntry,
} from './world-session-registry';

export interface WorldSessionContainer {
  key: WorldSessionKey;
  connectionId: string | null;
  connection: MudConnection | null;
}

export interface WorldSessionContainerRegistry {
  container: {
    get(key: WorldSessionKey): WorldSessionContainer | null;
    getByTabId(tabId: string): WorldSessionContainer | null;
    getKeyByTabId(tabId: string): WorldSessionKey | null;
    has(key: WorldSessionKey): boolean;
    hasByTabId(tabId: string): boolean;
    ensure(key: WorldSessionKey): WorldSessionContainer;
    ensureByTabId(tabId: string, key: WorldSessionKey): WorldSessionContainer;
    set(key: WorldSessionKey, tabId?: string | null): WorldSessionContainer;
    attachTabId(tabId: string, key: WorldSessionKey): void;
    detachTabId(tabId: string): void;
    delete(key: WorldSessionKey): boolean;
    deleteByTabId(tabId: string): boolean;
    entries(): Array<WorldSessionRegistryEntry<WorldSessionContainer>>;
    clear(): void;
  };
  connection: {
    get(key: WorldSessionKey): MudConnection | null;
    getByTabId(tabId: string): MudConnection | null;
    send(key: WorldSessionKey, command: string): boolean;
    sendByTabId(tabId: string, command: string): boolean;
    ensure(key: WorldSessionKey, connectionId?: string | null): MudConnection | null;
    ensureByTabId(tabId: string, connectionId?: string | null): MudConnection | null;
    setConnectionId(key: WorldSessionKey, connectionId: string): void;
    setConnectionIdByTabId(tabId: string, connectionId: string): void;
    close(key: WorldSessionKey): Promise<void>;
    closeByTabId(tabId: string): Promise<void>;
    release(key: WorldSessionKey): Promise<void>;
    releaseByTabId(tabId: string): Promise<void>;
    clear(): Promise<void>;
  };
}

export function createWorldSessionContainer(key: WorldSessionKey): WorldSessionContainer {
  return {
    key: createWorldSessionKey(key.worldId, key.characterId),
    connectionId: null,
    connection: null,
  };
}

export function createWorldSessionContainerRegistry(): WorldSessionContainerRegistry {
  const registry: WorldSessionRegistry<WorldSessionContainer> = createWorldSessionRegistry<WorldSessionContainer>();

  function getContainer(key: WorldSessionKey): WorldSessionContainer | null {
    return registry.get(key);
  }

  function getContainerByTabId(tabId: string): WorldSessionContainer | null {
    return registry.getByTabId(tabId);
  }

  function ensureContainer(key: WorldSessionKey): WorldSessionContainer {
    return registry.ensure(key, createWorldSessionContainer);
  }

  function ensureConnection(container: WorldSessionContainer, connectionId?: string | null): MudConnection | null {
    const nextConnectionId = connectionId ?? container.connectionId;
    if (!container.connection && !nextConnectionId) {
      return null;
    }

    if (!container.connection) {
      container.connectionId = nextConnectionId;
      container.connection = new MudConnection(nextConnectionId as string);
      return container.connection;
    }

    if (nextConnectionId && container.connectionId !== nextConnectionId) {
      container.connectionId = nextConnectionId;
    }

    return container.connection;
  }

  async function closeConnection(container: WorldSessionContainer): Promise<void> {
    if (!container.connection) {
      return;
    }

    await container.connection.close();
  }

  async function releaseConnection(container: WorldSessionContainer): Promise<void> {
    const connection = container.connection;
    container.connection = null;

    if (!connection) {
      return;
    }

    await connection.close();
  }

  async function clearConnections(): Promise<void> {
    const containers = registry.entries().map((entry) => entry.value);
    for (const container of containers) {
      await releaseConnection(container);
    }
  }

  return {
    container: {
      get: registry.get,
      getByTabId: registry.getByTabId,
      getKeyByTabId: registry.getKeyByTabId,
      has: registry.has,
      hasByTabId: registry.hasByTabId,
      ensure(key: WorldSessionKey): WorldSessionContainer {
        return ensureContainer(key);
      },
      ensureByTabId(tabId: string, key: WorldSessionKey): WorldSessionContainer {
        return registry.ensureByTabId(tabId, key, createWorldSessionContainer);
      },
      set(key: WorldSessionKey, tabId: string | null = null): WorldSessionContainer {
        return registry.set(key, createWorldSessionContainer(key), tabId);
      },
      attachTabId: registry.attachTabId,
      detachTabId: registry.detachTabId,
      delete: registry.delete,
      deleteByTabId: registry.deleteByTabId,
      entries: registry.entries,
      clear(): void {
        registry.clear();
      },
    },
    connection: {
      get(key: WorldSessionKey): MudConnection | null {
        return getContainer(key)?.connection ?? null;
      },
      getByTabId(tabId: string): MudConnection | null {
        return getContainerByTabId(tabId)?.connection ?? null;
      },
      send(key: WorldSessionKey, command: string): boolean {
        const connection = getContainer(key)?.connection;
        if (!connection) {
          return false;
        }

        connection.send(command);
        return true;
      },
      sendByTabId(tabId: string, command: string): boolean {
        const connection = getContainerByTabId(tabId)?.connection;
        if (!connection) {
          return false;
        }

        connection.send(command);
        return true;
      },
      ensure(key: WorldSessionKey, connectionId: string | null = null): MudConnection | null {
        return ensureConnection(ensureContainer(key), connectionId);
      },
      ensureByTabId(tabId: string, connectionId: string | null = null): MudConnection | null {
        const container = getContainerByTabId(tabId);
        if (!container) {
          return null;
        }

        return ensureConnection(container, connectionId);
      },
      setConnectionId(key: WorldSessionKey, connectionId: string): void {
        ensureContainer(key).connectionId = connectionId;
      },
      setConnectionIdByTabId(tabId: string, connectionId: string): void {
        const container = getContainerByTabId(tabId);
        if (container) {
          container.connectionId = connectionId;
        }
      },
      async close(key: WorldSessionKey): Promise<void> {
        const container = getContainer(key);
        if (!container) {
          return;
        }

        await closeConnection(container);
      },
      async closeByTabId(tabId: string): Promise<void> {
        const container = getContainerByTabId(tabId);
        if (!container) {
          return;
        }

        await closeConnection(container);
      },
      async release(key: WorldSessionKey): Promise<void> {
        const container = getContainer(key);
        if (!container) {
          return;
        }

        await releaseConnection(container);
      },
      async releaseByTabId(tabId: string): Promise<void> {
        const container = getContainerByTabId(tabId);
        if (!container) {
          return;
        }

        await releaseConnection(container);
      },
      clear: clearConnections,
    },
  };
}

export { createWorldSessionKey };
