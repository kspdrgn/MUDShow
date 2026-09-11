/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FuzzBallPropertyCacheStore,
  getFuzzballStorageNodeLoadPath,
} from '../storage-cache.js';

const fuzzballStorageCache = new FuzzBallPropertyCacheStore();

test('directory loads request a trailing slash when children are not loaded yet', () => {
  const state = { worldId: 'world-a', characterId: 'character-a' };
  const cache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);

  cache.upsertNode({ path: '/prefs/', type: 'str', value: '7', hasChildren: true });

  assert.equal(getFuzzballStorageNodeLoadPath(fuzzballStorageCache, state, '/prefs'), '/prefs/');
});

test('value-only loads keep the normalized path without a trailing slash', () => {
  const state = { worldId: 'world-b', characterId: 'character-b' };
  const cache = fuzzballStorageCache.getSessionCache(state.worldId, state.characterId);

  cache.upsertNode({ path: '/ride/_mode', type: 'str', value: 'walk' });

  assert.equal(getFuzzballStorageNodeLoadPath(fuzzballStorageCache, state, '/ride/_mode'), '/ride/_mode');
});
