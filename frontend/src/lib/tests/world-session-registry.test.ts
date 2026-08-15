/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorldSessionKey,
  createWorldSessionRegistry,
} from '../world-session-registry.js';

test('world session keys normalize world-only access and preserve character ids', () => {
  const worldOnly = createWorldSessionKey('world-a', '');
  const withCharacter = createWorldSessionKey('world-a', 'character-a');

  assert.equal(worldOnly.worldId, 'world-a');
  assert.equal(worldOnly.characterId, null);
  assert.equal(withCharacter.worldId, 'world-a');
  assert.equal(withCharacter.characterId, 'character-a');
});

test('world session registry resolves sessions by key and tracks entries', () => {
  const registry = createWorldSessionRegistry<{ label: string }>();
  const key = createWorldSessionKey('world-a', 'character-a');

  const value = registry.ensure(key, () => ({ label: 'session-a' }));
  const byKey = registry.get(key);

  assert.strictEqual(value, byKey);
  assert.ok(registry.has(key));
  assert.equal(registry.entries().length, 1);
  assert.equal(registry.entries()[0]?.key.worldId, 'world-a');
});

test('world session registry disposes values when entries are replaced, deleted, or cleared', () => {
  const disposed: string[] = [];
  const registry = createWorldSessionRegistry<{ label: string }>({
    dispose: (value) => {
      disposed.push(value.label);
    },
  });
  const firstKey = createWorldSessionKey('world-a', 'character-a');
  const secondKey = createWorldSessionKey('world-b', null);

  registry.set(firstKey, { label: 'first' });
  registry.set(firstKey, { label: 'replacement' });
  assert.deepEqual(disposed, ['first']);

  registry.set(secondKey, { label: 'second' });
  assert.equal(registry.delete(secondKey), true);
  assert.deepEqual(disposed, ['first', 'second']);

  registry.set(secondKey, { label: 'third' });
  registry.clear();
  assert.deepEqual(disposed, ['first', 'second', 'third']);
});
