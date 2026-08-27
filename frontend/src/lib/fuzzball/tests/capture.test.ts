/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { captureFuzzballWorldLine } from '../capture.js';
import { fuzzballStorageCache } from '../storage-cache.js';

test('captures every property from a multi-line server response', () => {
  const worldId = 'capture-world';
  const characterId = 'capture-character';
  fuzzballStorageCache.clearSessionCache(worldId, characterId);

  const captured = captureFuzzballWorldLine(
    worldId,
    characterId,
    'str /alpha:first\ndir /prefs/: (no value)\nstr /prefs/theme:dark\n3 properties listed.\n',
  );

  const cache = fuzzballStorageCache.getSessionCache(worldId, characterId);
  assert.equal(captured, true);
  assert.deepEqual(cache.getNodePaths(), ['/', '/alpha', '/prefs', '/prefs/theme']);
  assert.equal(cache.getChildren('/').map((node) => node.path).join(','), '/alpha,/prefs');
  assert.equal(cache.getSnapshot('/prefs/theme')?.value, 'dark');
});
