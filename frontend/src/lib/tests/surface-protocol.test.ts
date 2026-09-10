import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorldSurfaceSnapshotStore,
  isWorldSurfaceJsonValue,
  parseWorldSurfaceCommand,
  parseWorldSurfaceLifecycleMessage,
  parseWorldSurfaceOpenRequest,
  parseWorldSurfaceLifecycleEvent,
  parseWorldSurfaceSnapshot,
  WORLD_SURFACE_PROTOCOL_VERSION,
  type WorldSurfaceCommand,
  type WorldSurfaceOpenRequest,
} from '../world-surface-protocol.js';
import { bindWorldSurfaceController } from '../surfaces/surface-controller.js';
import { createSurfaceTransportHub } from '../surfaces/surface-transport.js';
import { SurfaceRegistry } from '../surfaces/surface-registry.js';

const descriptor = {
  protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
  surfaceId: 'test-surface',
  rendererId: 'test-renderer',
  title: 'Test surface',
  capabilities: {
    canClose: true,
    canDock: true,
    canFloat: true,
    canPopOut: true,
    canPopIn: true,
    allowsMultipleInstances: true,
  },
} as const;

const openRequest: WorldSurfaceOpenRequest = {
  protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
  surface: descriptor,
  instanceId: 'instance-1',
  sourceSessionKey: { worldId: 'world-1', characterId: 'character-1' },
};

test('protocol decoders enforce version and JSON-safe messages', () => {
  const command: WorldSurfaceCommand = {
    protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
    surfaceId: 'test-surface',
    instanceId: 'instance-1',
    requestId: 'request-1',
    revision: 3,
    type: 'refresh',
    payload: { reason: 'user' },
  };
  assert.deepEqual(parseWorldSurfaceCommand(command), command);
  assert.equal(parseWorldSurfaceCommand({ ...command, protocolVersion: 2 }), null);
  assert.equal(parseWorldSurfaceCommand({ ...command, payload: { value: undefined } }), null);
  assert.equal(parseWorldSurfaceCommand({ ...command, revision: -1 }), null);
  assert.deepEqual(parseWorldSurfaceLifecycleEvent({ type: 'resyncRequested' }), { type: 'resyncRequested' });
  assert.equal(parseWorldSurfaceLifecycleEvent({ type: 'not-a-lifecycle-event' }), null);
  assert.deepEqual(parseWorldSurfaceOpenRequest(openRequest), openRequest);
  assert.equal(parseWorldSurfaceOpenRequest({ ...openRequest, protocolVersion: 2 }), null);
  assert.deepEqual(parseWorldSurfaceLifecycleMessage({
    protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
    surfaceId: 'test-surface',
    instanceId: 'instance-1',
    revision: 1,
    type: 'opened',
  })?.type, 'opened');
  assert.equal(parseWorldSurfaceLifecycleMessage({ type: 'opened' }), null);
  assert.equal(parseWorldSurfaceSnapshot({
    protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
    surfaceId: 'test-surface',
    instanceId: 'instance-1',
    revision: 1,
    model: { invalid: undefined },
  }), null);
  const shared = { value: 'safe' };
  assert.equal(isWorldSurfaceJsonValue({ left: shared, right: shared }), true);
  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.equal(isWorldSurfaceJsonValue(cyclic), false);
});

test('snapshot store accepts only newer revisions and disposes subscriptions', () => {
  const store = createWorldSurfaceSnapshotStore();
  const revisions: number[] = [];
  store.subscribe('instance-1', (snapshot) => revisions.push(snapshot.revision));

  const makeSnapshot = (revision: number) => ({
    protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
    surfaceId: 'test-surface',
    instanceId: 'instance-1',
    revision,
    model: { revision },
  });

  assert.equal(store.publish(makeSnapshot(2)), true);
  assert.equal(store.publish(makeSnapshot(1)), false);
  assert.equal(store.publish(makeSnapshot(2)), false);
  assert.deepEqual(revisions, [2]);
  store.dispose('instance-1');
  assert.equal(store.get('instance-1'), null);
});

test('transport routes versioned commands, snapshots, resync, and close lifecycle', async () => {
  const hub = createSurfaceTransportHub();
  const session = hub.ensureSession<{ action: string }, { value: string }>('test-surface', 'instance-1');
  const commands: string[] = [];
  const snapshots: string[] = [];
  const lifecycle: string[] = [];
  const errors: string[] = [];
  session.onCommand((command) => commands.push(command.type));
  session.onSnapshot((snapshot) => snapshots.push((snapshot.model as { value: string }).value));
  session.onLifecycle((event) => lifecycle.push(event.type));
  session.onError((error) => errors.push(error.code));

  const command = session.sendCommand('refresh', { action: 'user' }, { requestId: 'request-1', expectedRevision: 0 });
  const first = session.publishSnapshot({ value: 'first' });
  session.requestResync('request-2');
  assert.equal(command?.protocolVersion, WORLD_SURFACE_PROTOCOL_VERSION);
  assert.equal(first?.revision, 1);
  assert.deepEqual(commands, ['refresh']);
  assert.deepEqual(snapshots, ['first']);
  assert.deepEqual(lifecycle, ['opened', 'resyncRequested']);

  assert.equal(session.sendCommand('stale', { action: 'nope' }, { expectedRevision: 0 }), null);
  assert.deepEqual(errors, ['stale-command']);
  session.close('test complete');
  assert.equal(session.isClosed(), true);
  assert.equal(session.sendCommand('after-close'), null);
  assert.deepEqual(lifecycle, ['opened', 'resyncRequested', 'closed']);
  assert.equal(hub.getSession('instance-1'), session);
  await Promise.resolve();
});

test('new sessions replace stale instance registrations without cross-delivery', () => {
  const hub = createSurfaceTransportHub();
  const first = hub.ensureSession<{ action: string }, { value: string }>('test-surface', 'same-instance');
  const received: string[] = [];
  first.onCommand((command) => received.push(command.type));
  const replacement = hub.ensureSession<{ action: string }, { value: string }>('other-surface', 'same-instance');

  assert.equal(first.isClosed(), true);
  first.sendCommand('stale');
  replacement.onCommand((command) => received.push(`replacement:${command.type}`));
  replacement.sendCommand('current');
  assert.deepEqual(received, ['replacement:current']);
});

test('controller binding publishes snapshots, handles commands, resyncs, and disposes', async () => {
  const hub = createSurfaceTransportHub();
  const session = hub.ensureSession<{ increment: number }, { count: number }>('test-surface', 'instance-1');
  let count = 0;
  let disposed = false;
  const controller = {
    open() {
      count = 1;
    },
    snapshot: () => ({ count }),
    handleCommand(command: WorldSurfaceCommand & { payload?: { increment: number } }) {
      count += command.payload?.increment ?? 0;
    },
    dispose() {
      disposed = true;
    },
  };
  const snapshots: number[] = [];
  session.onSnapshot((snapshot) => snapshots.push((snapshot.model as { count: number }).count));
  const binding = bindWorldSurfaceController(session, openRequest, controller);
  await Promise.resolve();
  assert.deepEqual(snapshots, [1]);
  session.sendCommand('increment', { increment: 2 });
  await Promise.resolve();
  assert.deepEqual(snapshots, [1, 3]);
  session.requestResync();
  assert.deepEqual(snapshots, [1, 3, 3]);
  binding.dispose();
  assert.equal(disposed, true);
  assert.equal(session.isClosed(), true);
});

test('registry preserves the last dock edge across native placement', () => {
  const registry = new SurfaceRegistry();
  registry.register(descriptor);
  registry.open('instance-1', 'test-surface', { host: 'dockview', mode: 'edge', edge: 'left' });
  registry.updatePlacement('instance-1', { host: 'native', windowId: 'window-1' });
  assert.equal(registry.get('instance-1')?.previousDockedEdge, 'left');
  registry.restoreDocked('instance-1');
  const restoredPlacement = registry.get('instance-1')?.placement;
  assert.equal(restoredPlacement?.host, 'dockview');
  assert.equal(
    restoredPlacement && restoredPlacement.host === 'dockview' && restoredPlacement.mode === 'edge'
      ? restoredPlacement.edge
      : null,
    'left',
  );
  registry.updatePlacement('instance-1', { host: 'dockview', mode: 'edge', edge: 'right' });
  assert.equal(registry.get('instance-1')?.previousDockedEdge, 'right');
  assert.throws(() => registry.open('instance-1', 'test-surface'));
  registry.unregister('test-surface');
  assert.equal(registry.get('instance-1'), null);
});
