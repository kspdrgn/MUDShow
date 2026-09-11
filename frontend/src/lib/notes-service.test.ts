/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createNotesWorkingStateService, type NotesStoragePort } from './notes-service.ts';

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

test('loads and tracks working notes by frontend tab', async () => {
  const { storage } = createStorage({ 'character-a': 'saved notes' });
  const service = createNotesWorkingStateService({ storage });

  assert.equal(await service.load('tab-a', 'character-a', false), 'saved notes');
  assert.equal(service.get('tab-a'), 'saved notes');

  service.set('tab-a', 'draft notes');
  assert.equal(service.get('tab-a'), 'draft notes');
});

test('debounces saves and persists the latest character-associated value', async () => {
  const { storage, saved } = createStorage();
  const service = createNotesWorkingStateService({ storage, debounceMs: 15 });

  service.scheduleSave('tab-a', 'character-a', 'first');
  service.scheduleSave('tab-a', 'character-a', 'latest');
  assert.deepEqual(saved, []);

  await new Promise((resolve) => setTimeout(resolve, 35));
  assert.deepEqual(saved, [{ characterId: 'character-a', notes: 'latest' }]);
});

test('flushes a pending save immediately and cancels its debounce timer', async () => {
  const { storage, saved } = createStorage();
  const service = createNotesWorkingStateService({ storage, debounceMs: 1000 });

  service.scheduleSave('tab-a', 'character-a', 'flush me');
  await service.flushSave('tab-a');
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(saved, [{ characterId: 'character-a', notes: 'flush me' }]);
});

test('clearing a tab cancels pending persistence and removes working state', async () => {
  const { storage, saved } = createStorage();
  const service = createNotesWorkingStateService({ storage, debounceMs: 10 });

  service.scheduleSave('tab-a', 'character-a', 'discard me');
  service.clear('tab-a');
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.equal(service.get('tab-a'), '');
  assert.deepEqual(saved, []);
});
