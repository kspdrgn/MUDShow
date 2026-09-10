import assert from 'node:assert/strict';
import test from 'node:test';

import {
  migrateStorageData,
  STORAGE_SCHEMA_VERSION,
} from './storage-migrations.ts';

test('migrates legacy name-keyed notes to character IDs', () => {
  const result = migrateStorageData({
    schemaVersion: 1,
    characters: [
      { id: 'character-1', name: '  Alice  ' },
      { id: 'character-2', name: 'Bob' },
    ],
    notes: {
      Alice: 'legacy note',
      'character-2': 'current note',
      Unknown: 'keep this user data',
    },
  });

  assert.equal(result.migrated, true);
  assert.equal(result.data.schemaVersion, STORAGE_SCHEMA_VERSION);
  assert.deepEqual(result.data.notes, {
    'character-1': 'legacy note',
    'character-2': 'current note',
    Unknown: 'keep this user data',
  });
});

test('does not rewrite current files or mutate the input object', () => {
  const input = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    notes: { 'character-1': 'note' },
  };

  const result = migrateStorageData(input);

  assert.equal(result.migrated, false);
  assert.deepEqual(result.data, input);
  assert.notEqual(result.data, input);
});

test('accepts unversioned legacy files as current without inventing a migration', () => {
  const result = migrateStorageData({ notes: { 'character-1': 'note' } });

  assert.equal(result.migrated, false);
  assert.equal(result.data.schemaVersion, undefined);
});

test('rejects invalid and newer schema versions', () => {
  for (const schemaVersion of [0, -1, 1.5, '1', null]) {
    assert.throws(
      () => migrateStorageData({ schemaVersion }),
      /invalid schema version/,
    );
  }

  assert.throws(
    () => migrateStorageData({ schemaVersion: STORAGE_SCHEMA_VERSION + 1 }),
    /supports version 2/,
  );
});
