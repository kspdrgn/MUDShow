export type PersistedStorageRecord = Record<string, unknown>;

export type StorageMigration = (data: PersistedStorageRecord) => PersistedStorageRecord;

export const STORAGE_SCHEMA_VERSION = 2;

function isRecord(value: unknown): value is PersistedStorageRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Version 1 saved notes by character name in some releases. Version 2 makes
 * the character ID the only durable key, so renaming a character does not
 * orphan its notes. Existing ID-keyed notes and unknown keys are preserved.
 */
function migrateV1ToV2(data: PersistedStorageRecord): PersistedStorageRecord {
  const characters = Array.isArray(data.characters) ? data.characters : [];
  const characterIds = new Set<string>();
  const idsByName = new Map<string, string>();

  for (const value of characters) {
    if (!isRecord(value)) {
      continue;
    }

    const id = nonEmptyString(value.id);
    const name = nonEmptyString(value.name);
    if (!id) {
      continue;
    }

    characterIds.add(id);
    if (name && !idsByName.has(name)) {
      idsByName.set(name, id);
    }
  }

  if (!isRecord(data.notes)) {
    return { ...data };
  }

  const notes: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data.notes)) {
    const migratedKey = characterIds.has(key) ? key : idsByName.get(key) ?? key;

    // Preserve file order: an existing ID-keyed value wins over a legacy
    // name-keyed value if both refer to the same character.
    if (!(migratedKey in notes) || migratedKey === key) {
      notes[migratedKey] = value;
    }
  }

  return {
    ...data,
    notes,
  };
}

// Breaking changes add a migration keyed by the version they produce.
export const STORAGE_MIGRATIONS: Record<number, StorageMigration> = {
  2: migrateV1ToV2,
};

export interface MigratedStorageData {
  data: PersistedStorageRecord;
  migrated: boolean;
}

/**
 * Validate the version and run each required migration exactly once, in order.
 * Missing versions are accepted as the current version for pre-versioned
 * files; an explicitly invalid or newer version is never treated as current.
 */
export function migrateStorageData(raw: PersistedStorageRecord): MigratedStorageData {
  const rawVersion = raw.schemaVersion;
  const version = rawVersion === undefined ? STORAGE_SCHEMA_VERSION : rawVersion;

  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new Error('the storage file has an invalid schema version');
  }

  if (version > STORAGE_SCHEMA_VERSION) {
    throw new Error(
      `the storage file uses schema version ${version}, but this app supports version ${STORAGE_SCHEMA_VERSION}`,
    );
  }

  let data = { ...raw };
  let migrated = false;

  for (let nextVersion = version + 1; nextVersion <= STORAGE_SCHEMA_VERSION; nextVersion += 1) {
    const migration = STORAGE_MIGRATIONS[nextVersion];
    if (!migration) {
      throw new Error(`no migration is available for storage schema version ${nextVersion}`);
    }

    data = migration(data);
    data.schemaVersion = nextVersion;
    migrated = true;
  }

  return { data, migrated };
}
