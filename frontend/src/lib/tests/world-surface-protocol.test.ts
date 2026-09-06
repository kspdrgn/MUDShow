/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorldSurfaceCommandRouter,
  createWorldSurfaceSnapshotStore,
  parseWorldSurfaceCommand,
  parseWorldSurfaceSnapshot,
  WORLD_SURFACE_PROTOCOL_VERSION,
  type WorldSurfaceSnapshot,
} from '../world-surface-protocol.js';

function snapshot(revision: number): WorldSurfaceSnapshot {
  return {
    protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
    surfaceId: 'tree-data',
    instanceId: 'surface-1',
    revision,
    model: { title: `revision ${revision}` },
  };
}

test('snapshot store publishes only newer revisions and notifies subscribers', () => {
  const store = createWorldSurfaceSnapshotStore();
  const received: number[] = [];
  const unsubscribe = store.subscribe('surface-1', (value) => received.push(value.revision));

  store.publish(snapshot(1));
  store.publish(snapshot(1));
  store.publish(snapshot(2));

  assert.deepEqual(received, [1, 2]);
  assert.equal(store.get('surface-1')?.revision, 2);
  unsubscribe();
  store.publish(snapshot(3));
  assert.deepEqual(received, [1, 2]);
});

test('disposing a surface removes its snapshot and listeners', () => {
  const store = createWorldSurfaceSnapshotStore();
  let notifications = 0;
  store.subscribe('surface-1', () => { notifications += 1; });
  store.publish(snapshot(1));
  store.dispose('surface-1');
  store.publish(snapshot(2));

  assert.equal(store.get('surface-1')?.revision, 2);
  assert.equal(notifications, 1);
});

test('command router delivers commands to the registered surface instance', () => {
  const router = createWorldSurfaceCommandRouter();
  const received: string[] = [];
  const unregister = router.register('surface-1', (command) => received.push(command.type));

  assert.equal(router.dispatch('surface-1', { type: 'refreshRequested' }), true);
  assert.equal(router.dispatch('missing', { type: 'ignored' }), false);
  unregister();
  assert.equal(router.dispatch('surface-1', { type: 'alsoIgnored' }), false);
  assert.deepEqual(received, ['refreshRequested']);
});

test('surface protocol decoders reject non-serializable or malformed messages', () => {
  assert.deepEqual(
    parseWorldSurfaceCommand({ type: 'refreshRequested', revision: 2, payload: { reason: 'user' } }),
    { type: 'refreshRequested', revision: 2, payload: { reason: 'user' } },
  );
  assert.equal(parseWorldSurfaceCommand({ type: '', payload: { value: undefined } }), null);
  assert.equal(parseWorldSurfaceCommand({ type: 'refreshRequested', revision: -1 }), null);
  assert.equal(parseWorldSurfaceSnapshot({ ...snapshot(1), model: { invalid: undefined } }), null);
  assert.deepEqual(parseWorldSurfaceSnapshot(snapshot(1)), snapshot(1));
});
