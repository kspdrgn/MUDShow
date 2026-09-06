/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFuzzballStorageSurfaceController,
  type FuzzballStorageSurfaceWindowRecord,
} from '../fuzzball/storage-surface-controller.js';
import type { FuzzballStorageViewerService } from '../fuzzball/storage-surface-controller.js';

function createHarness() {
  const windows: FuzzballStorageSurfaceWindowRecord[] = [];
  const states = new Map<string, { sourceTabId: string; worldId: string; characterId: string; title: string }>();
  const opened: Array<Record<string, unknown>> = [];
  const activated: string[] = [];
  const focused: string[] = [];
  const service: FuzzballStorageViewerService = {
    createState: (sourceTabId, worldId, characterId, title) => ({
      sourceTabId,
      worldId,
      characterId,
      title,
    }),
    requestNodeLoad: () => {},
    buildModel: () => ({}) as never,
  };

  const controller = createFuzzballStorageSurfaceController({
    listWindows: () => windows,
    isSurfaceWindow: (window) => window.surfaceId === 'fuzzball-storage-viewer',
    activateWindow: (windowId) => activated.push(windowId),
    focusWindow: (windowId) => focused.push(windowId),
    ensureSurface: () => 'fuzzball-storage-viewer',
    getViewerService: () => service,
    ensureTransport: () => {},
    rememberTransport: () => {},
    requestInitialLoad: () => {},
    registerTreeSurfaceInstance: () => {},
    disposeTreeSurfaceInstance: () => {},
    log: () => {},
    openSurface: (options) => {
      opened.push(options);
      windows.push({ id: options.instanceId, surfaceId: options.surfaceId, placement: 'in-app' });
    },
  });

  return { controller, windows, states, opened, activated, focused };
}

test('opens one viewer per source tab with plugin surface data', () => {
  const harness = createHarness();

  harness.controller.open('tab-1', 'world-1', 'character-1', 'World · Character storage');

  assert.equal(harness.opened.length, 1);
  assert.equal(harness.opened[0].surfaceId, 'fuzzball-storage-viewer');
  assert.equal(harness.controller.getState('fuzzball-storage-window-tab-1')?.worldId, 'world-1');
  assert.deepEqual(harness.activated, ['fuzzball-storage-window-tab-1']);
  assert.deepEqual(harness.focused, ['fuzzball-storage-window-tab-1']);

  harness.controller.open('tab-1', 'world-1', 'character-1', 'World · Character storage');
  assert.deepEqual(harness.activated, ['fuzzball-storage-window-tab-1', 'fuzzball-storage-window-tab-1']);
  assert.deepEqual(harness.focused, ['fuzzball-storage-window-tab-1', 'fuzzball-storage-window-tab-1']);
  assert.equal(harness.opened.length, 1);
});
