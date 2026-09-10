/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorldSessionServices,
  type WorldSessionStoragePort,
} from '../world-session-services.js';

function createStorage(): WorldSessionStoragePort & {
  savedNotes: Array<[string, string]>;
  savedHistory: Array<[string, number]>;
} {
  const savedNotes: Array<[string, string]> = [];
  const savedHistory: Array<[string, number]> = [];

  return {
    savedNotes,
    savedHistory,
    async loadNotes(): Promise<string> {
      return 'stored notes';
    },
    async saveNotes(characterId, notes): Promise<void> {
      savedNotes.push([characterId, notes]);
    },
    async loadTranscriptHistory(): Promise<never[]> {
      return [];
    },
    async saveTranscriptHistory(characterId, history): Promise<void> {
      savedHistory.push([characterId, history.reduce((total, entry) => total + entry.lines, 0)]);
    },
  };
}

test('world-session notes service owns working text and preserves debounce/flush behavior', async () => {
  const storage = createStorage();
  const { notes } = createWorldSessionServices(
    { worldId: 'world-a', characterId: 'character-a' },
    storage,
  );

  assert.equal(await notes.load(false), 'stored notes');
  notes.scheduleSave('debounced', 0);
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.deepEqual(storage.savedNotes, [['character-a', 'debounced']]);

  notes.scheduleSave('flushed', 1000);
  notes.flush();
  assert.deepEqual(storage.savedNotes, [
    ['character-a', 'debounced'],
    ['character-a', 'flushed'],
  ]);
  notes.scheduleSave('canceled', 20);
  notes.dispose();
  await new Promise((resolve) => setTimeout(resolve, 25));
  assert.deepEqual(storage.savedNotes, [
    ['character-a', 'debounced'],
    ['character-a', 'flushed'],
  ]);
});

test('world-session transcript service owns rolling history coordination without owning rendering', async () => {
  const storage = createStorage();
  const { transcript } = createWorldSessionServices(
    { worldId: 'world-a', characterId: 'character-a' },
    storage,
  );

  transcript.appendHistory('old\nold\n', 2);
  transcript.appendHistory('new\n', 2);
  assert.deepEqual(transcript.getHistory().map((entry) => entry.text), ['new\n']);
  transcript.saveHistory(2);
  assert.deepEqual(storage.savedHistory, [['character-a', 1]]);

  const worldOnly = createWorldSessionServices({ worldId: 'world-a', characterId: null }, storage);
  assert.deepEqual(await worldOnly.transcript.loadHistory(20, false), []);
  worldOnly.transcript.appendHistory('ignored\n', 20);
  worldOnly.transcript.saveHistory(20);
  assert.deepEqual(storage.savedHistory, [['character-a', 1]]);
});
