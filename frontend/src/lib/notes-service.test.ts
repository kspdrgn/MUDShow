/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotesWorkingStateService, type NotesStoragePort } from './notes-service.js';

function createStorage(initial: Record<string, string> = {}) {
  const saved: Array<{ characterId: string; notes: string }> = [];
  const storage: NotesStoragePort = {
    async loadNotes(characterId): Promise<string> {
      return initial[characterId] ?? '';
    },
    async saveNotes(characterId, notes): Promise<void> {
      saved.push({ characterId, notes });
    },
  };
  return { storage, saved };
}

test('loads and tracks working notes for a world session', async () => {
  const { storage } = createStorage({ 'character-a': 'saved notes' });
  const service = createNotesWorkingStateService({ storage, characterId: 'character-a' });

  assert.equal(await service.load(false), 'saved notes');
  assert.equal(service.get(), 'saved notes');

  service.set('draft notes');
  assert.equal(service.get(), 'draft notes');
});

test('debounces saves and persists the latest character-associated value', async () => {
  const { storage, saved } = createStorage();
  const service = createNotesWorkingStateService({ storage, characterId: 'character-a', debounceMs: 15 });

  service.scheduleSave('first');
  service.scheduleSave('latest');
  assert.deepEqual(saved, []);

  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.deepEqual(saved, [{ characterId: 'character-a', notes: 'latest' }]);
});

test('flushes a pending save immediately and cancels its debounce timer', async () => {
  const { storage, saved } = createStorage();
  const service = createNotesWorkingStateService({ storage, characterId: 'character-a', debounceMs: 1000 });

  service.scheduleSave('flush me');
  await service.flush();
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(saved, [{ characterId: 'character-a', notes: 'flush me' }]);
});

test('disposing a session service cancels pending persistence', async () => {
  const { storage, saved } = createStorage();
  const service = createNotesWorkingStateService({ storage, characterId: 'character-a', debounceMs: 10 });

  service.scheduleSave('discard me');
  service.dispose();
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(service.get(), 'discard me');
  assert.deepEqual(saved, []);
});
