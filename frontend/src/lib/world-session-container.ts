import {
  createWorldSessionKey,
  createWorldSessionRegistry,
  type WorldSessionKey,
  type WorldSessionRegistry,
  type WorldSessionRegistryEntry,
} from './world-session-registry';

export interface WorldSessionContainer {
  key: WorldSessionKey;
}

export interface WorldSessionContainerRegistry {
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
}

export function createWorldSessionContainer(key: WorldSessionKey): WorldSessionContainer {
  return {
    key: createWorldSessionKey(key.worldId, key.characterId),
  };
}

export function createWorldSessionContainerRegistry(): WorldSessionContainerRegistry {
  const registry: WorldSessionRegistry<WorldSessionContainer> = createWorldSessionRegistry<WorldSessionContainer>();

  return {
    get: registry.get,
    getByTabId: registry.getByTabId,
    getKeyByTabId: registry.getKeyByTabId,
    has: registry.has,
    hasByTabId: registry.hasByTabId,
    ensure(key: WorldSessionKey): WorldSessionContainer {
      return registry.ensure(key, createWorldSessionContainer);
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
    clear: registry.clear,
  };
}

export { createWorldSessionKey };
