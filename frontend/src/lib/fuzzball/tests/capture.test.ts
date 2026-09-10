/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { captureFuzzballWorldLine } from '../capture.js';
import { FuzzBallPropertyTreeCache } from '../storage-cache.js';

test('captures every property from a multi-line server response', () => {
  const worldId = 'capture-world';
  const characterId = 'capture-character';
  const cache = new FuzzBallPropertyTreeCache();

  const captured = captureFuzzballWorldLine(
    'str /alpha:first\ndir /prefs/: (no value)\nstr /prefs/theme:dark\n3 properties listed.\n',
    cache,
  );

  assert.equal(captured, true);
  assert.deepEqual(cache.getNodePaths(), ['/', '/alpha', '/prefs', '/prefs/theme']);
  assert.equal(cache.getChildren('/').map((node) => node.path).join(','), '/alpha,/prefs');
  assert.equal(cache.getSnapshot('/prefs/theme')?.value, 'dark');
});

test('property-count responses complete the requested branch listing', () => {
  const worldId = 'capture-world-with-load';
  const characterId = 'capture-character-with-load';
  const cache = new FuzzBallPropertyTreeCache();
  cache.beginChildrenLoad('/');
  captureFuzzballWorldLine('dir /ride/: (no value)\n1 property listed.\n', cache);

  assert.equal(cache.getSnapshot('/')?.areChildrenLoaded, true);
  assert.equal(cache.getSnapshot('/ride')?.areChildrenLoaded, false);
});
