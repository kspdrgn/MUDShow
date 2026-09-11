import assert from 'node:assert/strict';
import test from 'node:test';

import { normalizeWorldCompatibility, supportsFuzzball, supportsTaps } from '../world-capabilities.js';
import { createWorldPluginRegistryForSession } from '../world-plugins.js';
import { createWorldPluginServiceBag } from '../world-plugin-registry.js';
import { createWorldSurfaceHost } from '../world-surface-host.js';
import { FUZZBALL_STORAGE_SURFACE_ID } from '../fuzzball/plugin.js';
import { createWorldSessionContainerRegistry } from '../world-session-container.js';
import type { WorldConnectionPort } from '../world-plugin.js';
import type { CharacterRecord, WorldRecord } from '../types.js';

const character: CharacterRecord = { id: 'character-1', worldId: 'world-1', name: 'Player' };

function world(compatibility: WorldRecord['compatibility']): WorldRecord {
  return {
    id: 'world-1',
    name: 'Test world',
    host: 'localhost',
    port: 4201,
    tls: false,
    verifyCertificate: false,
    compatibility,
  };
}

function createFixture(profile: WorldRecord['compatibility']) {
  const sent: string[] = [];
  const opened: string[] = [];
  const connection: WorldConnectionPort = { send: (command) => sent.push(command) };
  const registry = createWorldPluginRegistryForSession(createWorldSessionContainerRegistry());
  const session = registry.createSession({
    world: world(profile),
    character,
    sessionKey: { worldId: 'world-1', characterId: character.id },
    connection,
    services: createWorldPluginServiceBag(),
    host: {
      invokeAction: () => {},
      openSurface: (_pluginId, surfaceId) => {
        opened.push(surfaceId);
      },
    },
  });
  return { session, sent, opened };
}

test('profile normalization and inherited capabilities are centralized', () => {
  assert.equal(normalizeWorldCompatibility('taps'), 'taps');
  assert.equal(normalizeWorldCompatibility('fuzzball'), 'fuzzball');
  assert.equal(normalizeWorldCompatibility('future-profile'), 'telnet');
  assert.equal(supportsFuzzball(world('fuzzball')), true);
  assert.equal(supportsFuzzball(world('taps')), true);
  assert.equal(supportsFuzzball(world('telnet')), false);
  assert.equal(supportsTaps(world('taps')), true);
  assert.equal(supportsTaps(world('fuzzball')), false);
});

test('Taps activates after FuzzBall and inherits its surface and property service', async () => {
  const fixture = createFixture('taps');
  assert.deepEqual(fixture.session.plugins.map((plugin) => plugin.id), ['fuzzball', 'taps']);
  assert.deepEqual(fixture.session.getSurfaces().map((surface) => surface.id), ['fuzzball-storage-viewer']);
  assert.deepEqual(fixture.session.getActions().map((action) => action.id), ['fuzzball-storage-viewer', 'taps-ride-mode']);

  fixture.session.handleConnected();
  assert.deepEqual(fixture.sent, ['examine me=/ride/_mode\r\n']);
  fixture.session.handleAttached({
    contractVersion: 1,
    runtimeId: 'runtime-1',
    connectionId: 'connection-1',
    sessionId: 1,
    sequence: 10,
    snapshotRevision: 2,
    snapshot: {
      connectionStatus: 'connected',
      lastError: null,
      negotiatedCapabilities: [],
      protocolState: null,
      diagnostics: [],
    },
  });
  assert.deepEqual(fixture.sent, [
    'examine me=/ride/_mode\r\n',
    'examine me=/\r\n',
    'examine me=/ride/_mode\r\n',
  ]);
  fixture.session.handleIncomingLine('/ride/_mode = hand');
  const rideAction = fixture.session.getActions().find((action) => action.id === 'taps-ride-mode');
  assert.equal(rideAction?.kind, 'select');
  if (rideAction?.kind === 'select') {
    assert.equal(rideAction.value, 'hand');
    rideAction.onChange('walk');
  }
  await Promise.resolve();
  assert.deepEqual(fixture.sent, [
    'examine me=/ride/_mode\r\n',
    'examine me=/\r\n',
    'examine me=/ride/_mode\r\n',
    '@set me=/ride/_mode:walk\r\n',
  ]);
  const pendingRideAction = fixture.session.getActions().find((action) => action.id === 'taps-ride-mode');
  assert.equal(pendingRideAction?.kind, 'select');
  if (pendingRideAction?.kind === 'select') assert.equal(pendingRideAction.value, 'walk');
  fixture.session.handleIncomingLine('/ride/_mode = walk');
  const syncedRideAction = fixture.session.getActions().find((action) => action.id === 'taps-ride-mode');
  assert.equal(syncedRideAction?.kind, 'select');
  if (syncedRideAction?.kind === 'select') assert.equal(syncedRideAction.value, 'walk');
  fixture.session.handleDisconnected();
  const disconnectedRideAction = fixture.session.getActions().find((action) => action.id === 'taps-ride-mode');
  assert.equal(disconnectedRideAction?.kind, 'select');
  if (disconnectedRideAction?.kind === 'select') assert.equal(disconnectedRideAction.value, null);
  fixture.session.handleConnected();
  assert.deepEqual(fixture.sent, [
    'examine me=/ride/_mode\r\n',
    'examine me=/\r\n',
    'examine me=/ride/_mode\r\n',
    '@set me=/ride/_mode:walk\r\n',
    'examine me=/ride/_mode\r\n',
  ]);
  fixture.session.handleIncomingLine('/ride/_mode = ride');

  const storageAction = fixture.session.getActions().find((action) => action.id === 'fuzzball-storage-viewer');
  if (storageAction?.kind === 'button') storageAction.onClick();
  assert.deepEqual(fixture.opened, ['fuzzball-storage-viewer']);
  await fixture.session.dispose();
});

test('Telnet and ordinary FuzzBall worlds do not activate Taps', async () => {
  const telnet = createFixture('telnet');
  assert.deepEqual(telnet.session.plugins, []);
  assert.deepEqual(telnet.session.getActions(), []);
  await telnet.session.dispose();

  const fuzzball = createFixture('fuzzball');
  assert.deepEqual(fuzzball.session.plugins.map((plugin) => plugin.id), ['fuzzball']);
  assert.deepEqual(fuzzball.session.getActions().map((action) => action.id), ['fuzzball-storage-viewer']);
  await fuzzball.session.dispose();
});

test('generic surface host opens and disposes plugin-owned instances by session', () => {
  const host = createWorldSurfaceHost();
  const surface = {
    id: FUZZBALL_STORAGE_SURFACE_ID,
    kind: 'plugin' as const,
    protocolVersion: 1 as const,
    rendererId: 'tree-data',
    defaultTitle: 'fuzzball storage viewer',
    capabilities: {
      canClose: true,
      canDock: true,
      canFloat: true,
      canPopOut: true,
      canPopIn: true,
      isModal: false,
      allowsMultipleInstances: true,
    },
  };
  host.register('fuzzball', surface);
  const key = { worldId: 'world-1', characterId: 'character-1' };
  const instanceId = host.createPort(key).openSurface('fuzzball', FUZZBALL_STORAGE_SURFACE_ID);

  assert.equal(host.registry.getInstance(instanceId)?.surfaceId, FUZZBALL_STORAGE_SURFACE_ID);
  assert.equal(host.transport.getSession(instanceId)?.isClosed(), false);
  host.closeSession(key);
  assert.equal(host.registry.getInstance(instanceId), null);
  assert.equal(host.transport.getSession(instanceId), null);
});
