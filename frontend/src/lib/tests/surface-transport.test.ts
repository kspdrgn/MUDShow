/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createSurfaceTransportHub } from '../surfaces/surface-transport.js';

test('surface transport session routes commands and snapshots with revisions', () => {
  const hub = createSurfaceTransportHub();
  const session = hub.ensureSession<string, { count: number }>('tree-data', 'instance-a');
  const commands: string[] = [];
  const snapshots: number[] = [];
  const lifecycle: string[] = [];

  session.onCommand((envelope) => {
    commands.push(`${envelope.payload}:${envelope.revision}`);
  });
  session.onSnapshot((envelope) => {
    snapshots.push(envelope.payload.count);
  });
  session.onLifecycle((envelope) => {
    lifecycle.push(envelope.payload.type);
  });

  const command = session.sendCommand('expand', { expectedRevision: 0 });
  const firstSnapshot = session.publishSnapshot({ count: 1 });
  const secondSnapshot = session.publishSnapshot({ count: 2 });
  const resync = session.requestResync('correlation-1');

  assert.equal(command?.payload, 'expand');
  assert.equal(command?.revision, 0);
  assert.deepEqual(commands, ['expand:0']);
  assert.equal(firstSnapshot?.revision, 1);
  assert.equal(secondSnapshot?.revision, 2);
  assert.deepEqual(snapshots, [1, 2]);
  assert.equal(resync?.payload.type, 'stateReconciled');
  assert.deepEqual(lifecycle, ['stateReconciled']);
  assert.deepEqual(session.getSnapshot()?.payload, { count: 2 });
});

test('surface transport session rejects stale commands and closes cleanly', () => {
  const hub = createSurfaceTransportHub();
  const session = hub.ensureSession<'open', { value: string }>('notes', 'instance-b');
  const commands: string[] = [];

  session.onCommand((envelope) => {
    commands.push(envelope.payload);
  });

  session.publishSnapshot({ value: 'initial' });

  assert.equal(session.sendCommand('open', { expectedRevision: 0 }) === null, true);
  assert.equal(session.sendCommand('open', { expectedRevision: 1 }) !== null, true);

  const deleted = hub.deleteSession('instance-b');
  const afterClose = session.sendCommand('open', { expectedRevision: 1 });

  assert.equal(deleted, true);
  assert.equal(afterClose, null);
  assert.deepEqual(commands, ['open']);
  assert.equal(session.isClosed(), true);
});

test('surface transport hub isolates multiple sessions and replaces stale registrations', () => {
  const hub = createSurfaceTransportHub();
  const first = hub.ensureSession<string, { label: string }>('debug-console', 'instance-c');
  const second = hub.ensureSession<string, { label: string }>('debug-console', 'instance-d');

  first.publishSnapshot({ label: 'first' });
  second.publishSnapshot({ label: 'second' });

  assert.equal(hub.entries().length, 2);
  assert.equal(hub.getSession<string, { label: string }>('instance-c')?.getSnapshot()?.payload.label, 'first');
  assert.equal(hub.getSession<string, { label: string }>('instance-d')?.getSnapshot()?.payload.label, 'second');

  const replacement = hub.ensureSession<string, { label: string }>('debug-console-reloaded', 'instance-c');

  assert.equal(first.isClosed(), true);
  assert.equal(replacement.isClosed(), false);
  assert.equal(replacement.surfaceId, 'debug-console-reloaded');
  assert.equal(hub.getSession<string, { label: string }>('instance-c')?.surfaceId, 'debug-console-reloaded');
});
