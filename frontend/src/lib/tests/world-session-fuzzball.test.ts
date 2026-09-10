/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createFuzzballPlugin, FUZZBALL_CACHE_SERVICE_KEY } from '../fuzzball/plugin.js';
import { createWorldSessionContainerRegistry } from '../world-session-container.js';
import { createWorldSessionKey } from '../world-session-registry.js';
import type { WorldPluginServiceKey } from '../world-plugin.js';

test('FuzzBall session contribution owns a disposable cache through its service bag', async () => {
  const containers = createWorldSessionContainerRegistry();
  const plugin = createFuzzballPlugin(containers);
  const services = new Map<string, unknown>();
  const sessionKey = createWorldSessionKey('fuzzball-world', 'fuzzball-character');
  const contribution = plugin.createSessionContribution({
    world: {
      id: 'fuzzball-world',
      name: 'FuzzBall',
      host: 'localhost',
      port: 4200,
      tls: false,
      verifyCertificate: false,
      compatibility: 'fuzzball',
    },
    character: {
      id: 'fuzzball-character',
      worldId: 'fuzzball-world',
      name: 'Player',
    },
    sessionKey,
    connection: { send: () => {} },
    services: {
      get: <T>(key: WorldPluginServiceKey<T>) => (services.get(key.id) as T | undefined) ?? null,
      set: <T>(key: WorldPluginServiceKey<T>, service: T) => { services.set(key.id, service); },
    },
    host: { invokeAction: () => {}, openSurface: () => {} },
  });

  const cache = services.get(FUZZBALL_CACHE_SERVICE_KEY.id) as { hasData(): boolean } | undefined;
  assert.ok(cache);
  contribution.onIncomingLine?.('str /prefs/theme:dark');
  assert.equal(cache.hasData(), true);

  await contribution.dispose?.();
  assert.equal(cache.hasData(), false);
  containers.container.clear();
});
