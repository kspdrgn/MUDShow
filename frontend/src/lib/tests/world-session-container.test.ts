/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorldSessionContainerRegistry,
  createWorldSessionKey,
} from '../world-session-container.js';

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

test('world session container keeps notes and transcript history services isolated', () => {
  const registry = createWorldSessionContainerRegistry();
  const firstKey = createWorldSessionKey('world-a', 'character-a');
  const secondKey = createWorldSessionKey('world-b', null);

  const firstNotes = registry.notes.ensure(firstKey);
  const secondNotes = registry.notes.ensure(secondKey);
  firstNotes.set('private');

  const firstTranscript = registry.transcript.ensure(firstKey);
  firstTranscript.appendHistory('hello\n', 10);

  assert.strictEqual(registry.notes.get(firstKey), firstNotes);
  assert.strictEqual(registry.transcript.get(firstKey), firstTranscript);
  assert.equal(secondNotes.get(), '');
  assert.deepEqual(firstTranscript.getHistory().map((entry) => entry.text), ['hello\n']);
  assert.deepEqual(registry.transcript.ensure(secondKey).getHistory(), []);
});
