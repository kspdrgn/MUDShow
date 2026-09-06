/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { createWorldPluginRegistry } from '../world-plugin-registry.js';
import { createInProcessWorldPluginProvider, type WorldPlugin, type WorldPluginServiceKey, type WorldPluginSessionContext } from '../world-plugin.js';

function context(): WorldPluginSessionContext {
  const services = new Map<string, unknown>();
  return {
    world: {
      id: 'taps-world',
      name: 'Taps',
      host: 'localhost',
      port: 4200,
      tls: false,
      verifyCertificate: false,
      compatibility: 'taps' as 'telnet',
    },
    character: null,
    sessionKey: { worldId: 'taps-world', characterId: null },
    connection: { send: () => {} },
    services: {
      get: <T>(key: WorldPluginServiceKey<T>) => (services.get(key.id) as T | undefined) ?? null,
      set: <T>(key: WorldPluginServiceKey<T>, service: T) => { services.set(key.id, service); },
    },
    host: { invokeAction: () => {}, openSurface: () => {} },
  };
}

function plugin(
  id: string,
  options: Partial<WorldPlugin> = {},
): WorldPlugin {
  return {
    id,
    label: id,
    canActivate: () => true,
    createSessionContribution: () => ({}),
    ...options,
  };
}

test('registry activates dependencies before dependents', () => {
  const registry = createWorldPluginRegistry();
  registry.register(plugin('taps', { dependencies: ['fuzzball'] }));
  registry.register(plugin('fuzzball'));

  assert.deepEqual(
    registry.resolveActive(context()).map((entry) => entry.id),
    ['fuzzball', 'taps'],
  );
});

test('registry rejects inactive or missing dependencies', () => {
  const registry = createWorldPluginRegistry();
  registry.register(plugin('taps', { dependencies: ['fuzzball'] }));
  assert.throws(() => registry.resolveActive(context()), /not registered/);

  registry.register(plugin('fuzzball', { canActivate: () => false }));
  assert.throws(() => registry.resolveActive(context()), /dependency is inactive/);
});

test('session dispatch isolates plugin failures and disposes in reverse order once', async () => {
  const errors: string[] = [];
  const events: string[] = [];
  let emitChange = () => {};
  const registry = createWorldPluginRegistry({
    onError: ({ pluginId, hook }) => errors.push(`${pluginId}:${hook}`),
  });

  registry.register(plugin('first', {
    createSessionContribution: () => ({
      onIncomingLine: () => {
        events.push('first-line');
        throw new Error('first failed');
      },
      dispose: () => { events.push('first-dispose'); },
    }),
  }));
  registry.register(plugin('second', {
    createSessionContribution: () => ({
      surfaces: [{
        id: 'second-surface',
        kind: 'builtin',
        protocolVersion: 1,
        rendererId: 'test',
        defaultTitle: 'second surface',
        capabilities: {
          canClose: true,
          canDock: true,
          canFloat: true,
          canPopOut: true,
          canPopIn: true,
          isModal: false,
          allowsMultipleInstances: true,
        },
      }],
      subscribe: (listener) => {
        emitChange = listener;
        return () => { emitChange = () => {}; };
      },
      actions: [{ kind: 'button', id: 'second', label: 'second', onClick: () => {} }],
      onIncomingLine: () => { events.push('second-line'); },
      dispose: () => { events.push('second-dispose'); },
    }),
  }));

  const session = registry.createSession(context());
  let changeCount = 0;
  session.subscribe(() => { changeCount += 1; });
  emitChange();
  assert.equal(changeCount, 1);
  session.handleIncomingLine('hello');
  assert.deepEqual(events, ['first-line', 'second-line']);
  assert.deepEqual(errors, ['first:incomingLine']);
  assert.equal(session.getActions().length, 1);
  assert.deepEqual(session.getSurfaces().map((surface) => surface.id), ['second-surface']);

  await session.dispose();
  await session.dispose();
  assert.deepEqual(events, ['first-line', 'second-line', 'second-dispose', 'first-dispose']);
});

test('session creation failure disposes already-created contributions', () => {
  const disposed: string[] = [];
  const registry = createWorldPluginRegistry();
  registry.register(plugin('first', {
    createSessionContribution: () => ({ dispose: () => { disposed.push('first'); } }),
  }));
  registry.register(plugin('second', {
    createSessionContribution: () => {
      throw new Error('creation failed');
    },
  }));

  assert.throws(() => registry.createSession(context()), /creation failed/);
  assert.deepEqual(disposed, ['first']);
});

test('registry rejects duplicate ids and supports unregistering', () => {
  const registry = createWorldPluginRegistry();
  const unregister = registry.register(plugin('one'));
  assert.throws(() => registry.register(plugin('one')), /already registered/);
  unregister();
  assert.equal(registry.get('one'), null);
});

test('registry accepts providers through the built-in adapter seam', () => {
  const registry = createWorldPluginRegistry();
  const unregister = registry.registerProvider(
    createInProcessWorldPluginProvider(() => plugin('provided')),
  );

  assert.equal(registry.get('provided')?.id, 'provided');
  unregister();
  assert.equal(registry.get('provided'), null);
});
