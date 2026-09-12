/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorldSessionContainerRegistry,
  createWorldSessionKey,
} from '../world-session-container.js';
import { NOTES_SERVICE_KEY } from '../notes-service.js';

test('world session container keeps debug console state isolated per session key', () => {
  const registry = createWorldSessionContainerRegistry();
  const firstKey = createWorldSessionKey('world-a', 'character-a');
  const secondKey = createWorldSessionKey('world-b', null);

  const firstConsole = registry.debugConsole.ensure(firstKey);
  firstConsole.entries.push({
    id: 1,
    timestamp: 1,
    direction: 'status',
    sourceLabel: 'world-a',
    text: 'hello',
    lineCount: 1,
  });

  const secondConsole = registry.debugConsole.ensure(secondKey);

  assert.strictEqual(registry.debugConsole.get(firstKey), firstConsole);
  assert.strictEqual(registry.debugConsole.get(secondKey), secondConsole);
  assert.equal(secondConsole.entries.length, 0);
  assert.equal(firstConsole.entries.length, 1);
});

test('world session container registers one notes service per session key', async () => {
  const saved: Array<[string, string]> = [];
  const registry = createWorldSessionContainerRegistry({
    storage: {
      async loadNotes(): Promise<string> {
        return 'stored';
      },
      async saveNotes(characterId, notes): Promise<void> {
        saved.push([characterId, notes]);
      },
    },
  });
  const key = createWorldSessionKey('world-a', 'character-a');
  const container = registry.container.ensure(key);
  const notes = container.services.get(NOTES_SERVICE_KEY);

  assert.ok(notes);
  assert.equal(await notes.load(false), 'stored');
  notes.scheduleSave('updated');
  await registry.container.close(key);

  assert.deepEqual(saved, [['character-a', 'updated']]);
  assert.equal(registry.container.get(key), null);
});

test('a recreated world session container reloads notes from storage', async () => {
  let storedNotes = 'before reload';
  const storage = {
    async loadNotes(): Promise<string> {
      return storedNotes;
    },
    async saveNotes(_characterId: string, notes: string): Promise<void> {
      storedNotes = notes;
    },
  };
  const key = createWorldSessionKey('world-reload', 'character-reload');
  const firstRegistry = createWorldSessionContainerRegistry({ storage });
  const firstService = firstRegistry.container.ensure(key).services.get(NOTES_SERVICE_KEY);

  assert.ok(firstService);
  assert.equal(await firstService.load(false), 'before reload');
  firstService.scheduleSave('after reload');
  await firstRegistry.container.close(key);

  const secondRegistry = createWorldSessionContainerRegistry({ storage });
  const secondService = secondRegistry.container.ensure(key).services.get(NOTES_SERVICE_KEY);

  assert.ok(secondService);
  assert.equal(await secondService.load(false), 'after reload');
  await secondRegistry.container.close(key);
});
