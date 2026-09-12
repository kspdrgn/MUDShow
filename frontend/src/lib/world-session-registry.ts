export interface WorldSessionKey {
  worldId: string;
  characterId: string | null;
}

export interface WorldSessionRegistryEntry<T> {
  key: WorldSessionKey;
  value: T;
}

export interface WorldSessionRegistryOptions<T> {
  dispose?: (value: T, key: WorldSessionKey) => void | Promise<void>;
}

export interface WorldSessionRegistry<T> {
  get(key: WorldSessionKey): T | null;
  has(key: WorldSessionKey): boolean;
  ensure(key: WorldSessionKey, createValue: (key: WorldSessionKey) => T): T;
  set(key: WorldSessionKey, value: T): T;
  delete(key: WorldSessionKey): boolean;
  deleteAsync(key: WorldSessionKey): Promise<boolean>;
  entries(): Array<WorldSessionRegistryEntry<T>>;
  clear(): void;
  clearAsync(): Promise<void>;
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

export function createWorldSessionRegistry<T>({
  dispose,
}: WorldSessionRegistryOptions<T> = {}): WorldSessionRegistry<T> {
  const entriesByKey = new Map<string, WorldSessionRegistryEntry<T>>();

  function getEntryBySerializedKey(serializedKey: string): WorldSessionRegistryEntry<T> | null {
    return entriesByKey.get(serializedKey) ?? null;
  }

  function getEntry(key: WorldSessionKey): WorldSessionRegistryEntry<T> | null {
    return getEntryBySerializedKey(serializeWorldSessionKey(key));
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

    entriesByKey.delete(serializedKey);
    if (dispose) {
      void Promise.resolve(dispose(entry.value, entry.key)).catch(() => undefined);
    }
    return true;
  }

  async function removeEntryAsync(serializedKey: string): Promise<boolean> {
    const entry = getEntryBySerializedKey(serializedKey);
    if (!entry) {
      return false;
    }

    entriesByKey.delete(serializedKey);
    await dispose?.(entry.value, entry.key);
    return true;
  }

  return {
    get(key: WorldSessionKey): T | null {
      return getEntry(key)?.value ?? null;
    },
    has(key: WorldSessionKey): boolean {
      return getEntry(key) !== null;
    },
    ensure(key: WorldSessionKey, createValue: (key: WorldSessionKey) => T): T {
      return ensureEntry(key, createValue).value;
    },
    set(key: WorldSessionKey, value: T): T {
      const serializedKey = serializeWorldSessionKey(key);
      const existing = getEntryBySerializedKey(serializedKey);
      const entry = ensureEntry(key, () => value);
      const previousValue = existing?.value ?? null;
      entry.value = value;

      if (dispose && previousValue !== null && previousValue !== value) {
        void Promise.resolve(dispose(previousValue, entry.key)).catch(() => undefined);
      }

      return value;
    },
    delete(key: WorldSessionKey): boolean {
      return removeEntry(serializeWorldSessionKey(key));
    },
    async deleteAsync(key: WorldSessionKey): Promise<boolean> {
      return removeEntryAsync(serializeWorldSessionKey(key));
    },
    entries(): Array<WorldSessionRegistryEntry<T>> {
      return [...entriesByKey.values()].map((entry) => ({
        key: cloneWorldSessionKey(entry.key),
        value: entry.value,
      }));
    },
    clear(): void {
      const entries = [...entriesByKey.entries()];
      entriesByKey.clear();

      if (!dispose) {
        return;
      }

      for (const [_, entry] of entries) {
        void Promise.resolve(dispose(entry.value, entry.key)).catch(() => undefined);
      }
    },
    async clearAsync(): Promise<void> {
      const entries = [...entriesByKey.entries()];
      entriesByKey.clear();

      await Promise.all(entries.map(([, entry]) => dispose?.(entry.value, entry.key)));
    },
  };
}
