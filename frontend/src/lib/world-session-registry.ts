export interface WorldSessionKey {
  worldId: string;
  characterId: string | null;
}

export interface WorldSessionRegistryEntry<T> {
  key: WorldSessionKey;
  tabId: string | null;
  value: T;
}

export interface WorldSessionRegistry<T> {
  get(key: WorldSessionKey): T | null;
  getByTabId(tabId: string): T | null;
  getKeyByTabId(tabId: string): WorldSessionKey | null;
  has(key: WorldSessionKey): boolean;
  hasByTabId(tabId: string): boolean;
  ensure(key: WorldSessionKey, createValue: (key: WorldSessionKey) => T): T;
  ensureByTabId(tabId: string, key: WorldSessionKey, createValue: (key: WorldSessionKey) => T): T;
  set(key: WorldSessionKey, value: T, tabId?: string | null): T;
  attachTabId(tabId: string, key: WorldSessionKey): void;
  detachTabId(tabId: string): void;
  delete(key: WorldSessionKey): boolean;
  deleteByTabId(tabId: string): boolean;
  entries(): Array<WorldSessionRegistryEntry<T>>;
  clear(): void;
}

function normalizeCharacterId(characterId: string | null | undefined): string | null {
  return characterId === ''
    ? null
    : characterId
    ?? null;
}

export function createWorldSessionKey(worldId: string, characterId: string | null = null): WorldSessionKey {
  return {
    worldId,
    characterId: normalizeCharacterId(characterId),
  };
}

function serializeWorldSessionKey(key: WorldSessionKey): string {
  return `${key.worldId}\u0000${key.characterId ?? ''}`;
}

function cloneWorldSessionKey(key: WorldSessionKey): WorldSessionKey {
  return {
    worldId: key.worldId,
    characterId: key.characterId,
  };
}

export function createWorldSessionRegistry<T>(): WorldSessionRegistry<T> {
  const entriesByKey = new Map<string, WorldSessionRegistryEntry<T>>();
  const keyByTabId = new Map<string, string>();

  function getEntryBySerializedKey(serializedKey: string): WorldSessionRegistryEntry<T> | null {
    return entriesByKey.get(serializedKey) ?? null;
  }

  function getEntry(key: WorldSessionKey): WorldSessionRegistryEntry<T> | null {
    return getEntryBySerializedKey(serializeWorldSessionKey(key));
  }

  function clearTabBinding(tabId: string): void {
    const serializedKey = keyByTabId.get(tabId);
    if (!serializedKey) {
      return;
    }

    keyByTabId.delete(tabId);
    const entry = getEntryBySerializedKey(serializedKey);
    if (entry?.tabId === tabId) {
      entry.tabId = null;
    }
  }

  function attachTabId(tabId: string, key: WorldSessionKey): void {
    const serializedKey = serializeWorldSessionKey(key);
    const entry = getEntryBySerializedKey(serializedKey);
    if (!entry) {
      throw new Error('cannot attach a tab id to a missing world session');
    }

    const currentKey = keyByTabId.get(tabId);
    if (currentKey && currentKey !== serializedKey) {
      clearTabBinding(tabId);
    }

    if (entry.tabId && entry.tabId !== tabId) {
      keyByTabId.delete(entry.tabId);
    }

    entry.tabId = tabId;
    keyByTabId.set(tabId, serializedKey);
  }

  function ensureEntry(key: WorldSessionKey, createValue: (key: WorldSessionKey) => T): WorldSessionRegistryEntry<T> {
    const serializedKey = serializeWorldSessionKey(key);
    const existing = getEntryBySerializedKey(serializedKey);
    if (existing) {
      return existing;
    }

    const nextKey = cloneWorldSessionKey(key);
    const created: WorldSessionRegistryEntry<T> = {
      key: nextKey,
      tabId: null,
      value: createValue(nextKey),
    };
    entriesByKey.set(serializedKey, created);
    return created;
  }

  function removeEntry(serializedKey: string): boolean {
    const entry = getEntryBySerializedKey(serializedKey);
    if (!entry) {
      return false;
    }

    if (entry.tabId) {
      keyByTabId.delete(entry.tabId);
    }

    entriesByKey.delete(serializedKey);
    return true;
  }

  return {
    get(key: WorldSessionKey): T | null {
      return getEntry(key)?.value ?? null;
    },
    getByTabId(tabId: string): T | null {
      const serializedKey = keyByTabId.get(tabId);
      if (!serializedKey) {
        return null;
      }

      const entry = getEntryBySerializedKey(serializedKey);
      if (!entry) {
        keyByTabId.delete(tabId);
        return null;
      }

      return entry.value;
    },
    getKeyByTabId(tabId: string): WorldSessionKey | null {
      const serializedKey = keyByTabId.get(tabId);
      if (!serializedKey) {
        return null;
      }

      const entry = getEntryBySerializedKey(serializedKey);
      if (!entry) {
        keyByTabId.delete(tabId);
        return null;
      }

      return cloneWorldSessionKey(entry.key);
    },
    has(key: WorldSessionKey): boolean {
      return getEntry(key) !== null;
    },
    hasByTabId(tabId: string): boolean {
      return this.getByTabId(tabId) !== null;
    },
    ensure(key: WorldSessionKey, createValue: (key: WorldSessionKey) => T): T {
      return ensureEntry(key, createValue).value;
    },
    ensureByTabId(tabId: string, key: WorldSessionKey, createValue: (key: WorldSessionKey) => T): T {
      const value = ensureEntry(key, createValue).value;
      attachTabId(tabId, key);
      return value;
    },
    set(key: WorldSessionKey, value: T, tabId: string | null = null): T {
      const entry = ensureEntry(key, () => value);
      entry.value = value;

      if (tabId !== null) {
        attachTabId(tabId, key);
      }

      return value;
    },
    attachTabId,
    detachTabId(tabId: string): void {
      clearTabBinding(tabId);
    },
    delete(key: WorldSessionKey): boolean {
      return removeEntry(serializeWorldSessionKey(key));
    },
    deleteByTabId(tabId: string): boolean {
      const serializedKey = keyByTabId.get(tabId);
      if (!serializedKey) {
        return false;
      }

      return removeEntry(serializedKey);
    },
    entries(): Array<WorldSessionRegistryEntry<T>> {
      return [...entriesByKey.values()].map((entry) => ({
        key: cloneWorldSessionKey(entry.key),
        tabId: entry.tabId,
        value: entry.value,
      }));
    },
    clear(): void {
      entriesByKey.clear();
      keyByTabId.clear();
    },
  };
}
