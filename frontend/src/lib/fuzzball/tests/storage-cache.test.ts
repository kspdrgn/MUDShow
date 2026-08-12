/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  FuzzBallPropertyCacheStore,
  FuzzBallPropertyTreeCache,
} from '../storage-cache.js';

test('session caches are keyed by world id and character id', () => {
  const store = new FuzzBallPropertyCacheStore();

  const first = store.getSessionCache('world-a', 'character-a');
  const second = store.getSessionCache('world-a', 'character-a');
  const otherCharacter = store.getSessionCache('world-a', 'character-b');
  const worldOnly = store.getSessionCache('world-b');
  const worldOnlyAgain = store.getSessionCache('world-b', '');

  assert.strictEqual(first, second);
  assert.notStrictEqual(first, otherCharacter);
  assert.strictEqual(worldOnly, worldOnlyAgain);
  assert.ok(store.hasSessionCache('world-a', 'character-a'));
  assert.ok(store.hasSessionCache('world-b', ''));
});

test('upserting a child synthesizes missing parents and preserves tree structure', () => {
  const cache = new FuzzBallPropertyTreeCache();

  cache.upsertNode({ path: '/prefs/colors/theme', type: 'str', value: 'dark' });

  const prefs = cache.getSnapshot('/prefs');
  const colors = cache.getSnapshot('/prefs/colors');
  const theme = cache.getSnapshot('/prefs/colors/theme');

  assert.ok(prefs);
  assert.ok(colors);
  assert.ok(theme);

  assert.equal(prefs?.type, 'dir');
  assert.equal(prefs?.isValueLoaded, false);
  assert.equal(prefs?.isExpanded, true);
  assert.equal(prefs?.hasChildren, true);
  assert.equal(prefs?.label, 'prefs · dir · no value');

  assert.equal(colors?.type, 'dir');
  assert.equal(colors?.isValueLoaded, false);
  assert.equal(colors?.isExpanded, true);
  assert.equal(colors?.hasChildren, true);

  assert.equal(theme?.type, 'str');
  assert.equal(theme?.value, 'dark');
  assert.equal(theme?.isValueLoaded, true);
  assert.equal(theme?.hasChildren, false);
  assert.equal(theme?.label, 'theme · str · dark');

  const rootChildren = cache.getChildren('/');
  assert.deepEqual(rootChildren.map((node) => node.name), ['prefs']);
  assert.equal(cache.getTree().hasChildren, true);
});

test('upserting the same path replaces the node data', () => {
  const cache = new FuzzBallPropertyTreeCache();

  cache.upsertNode({ path: '/prefs/limit', type: 'str', value: '12' });
  const first = cache.getSnapshot('/prefs/limit');

  cache.upsertNode({ path: '/prefs/limit', type: 'int', value: '24' });
  const second = cache.getSnapshot('/prefs/limit');

  assert.ok(first);
  assert.ok(second);
  assert.equal(first?.type, 'str');
  assert.equal(first?.value, '12');
  assert.equal(second?.type, 'int');
  assert.equal(second?.value, '24');
  assert.equal(second?.label, 'limit · int · 24');
});

test('markExpanded updates tree state without dropping existing data', () => {
  const cache = new FuzzBallPropertyTreeCache();

  cache.upsertNode({ path: '/prefs/theme', type: 'str', value: 'ember' });
  cache.markExpanded('/prefs');

  const prefs = cache.getSnapshot('/prefs');
  const tree = cache.getTree();

  assert.ok(prefs);
  assert.equal(prefs?.isExpanded, true);
  assert.equal(tree.path, '/');
  assert.equal(tree.hasChildren, true);
});
