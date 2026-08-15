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

test('world session registry resolves sessions by key and tab id', () => {
  const registry = createWorldSessionRegistry<{ label: string }>();
  const key = createWorldSessionKey('world-a', 'character-a');

  const value = registry.ensureByTabId('tab-a', key, () => ({ label: 'session-a' }));
  const byKey = registry.get(key);
  const byTab = registry.getByTabId('tab-a');
  const keyByTab = registry.getKeyByTabId('tab-a');

  assert.strictEqual(value, byKey);
  assert.strictEqual(value, byTab);
  assert.deepEqual(keyByTab, key);
  assert.ok(registry.has(key));
  assert.ok(registry.hasByTabId('tab-a'));
});

test('world session registry can rebind a tab id and clean up stale entries', () => {
  const registry = createWorldSessionRegistry<{ label: string }>();
  const firstKey = createWorldSessionKey('world-a', 'character-a');
  const secondKey = createWorldSessionKey('world-b', null);

  registry.ensure(firstKey, () => ({ label: 'first' }));
  registry.ensure(secondKey, () => ({ label: 'second' }));
  registry.attachTabId('tab-a', firstKey);
  registry.attachTabId('tab-a', secondKey);

  assert.equal(registry.getByTabId('tab-a')?.label, 'second');
  assert.equal(registry.getKeyByTabId('tab-a')?.worldId, 'world-b');
  assert.equal(registry.getKeyByTabId('tab-a')?.characterId, null);
  assert.equal(registry.entries().filter((entry) => entry.tabId === 'tab-a').length, 1);

  assert.equal(registry.deleteByTabId('tab-a'), true);
  assert.equal(registry.getByTabId('tab-a'), null);
  assert.equal(registry.get(secondKey), null);
  assert.ok(registry.get(firstKey));
});
