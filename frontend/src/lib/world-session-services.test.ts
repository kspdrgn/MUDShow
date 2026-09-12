/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createWorldSessionServiceHost,
  createWorldSessionServiceKey,
} from './world-session-services.js';

interface TestService {
  flush(): Promise<void>;
  dispose(): void;
}

const TEST_SERVICE_KEY = createWorldSessionServiceKey<TestService>('test');

test('session service host awaits flush and disposes registered services', async () => {
  let flushed = false;
  let disposed = false;
  const host = createWorldSessionServiceHost({ flushTimeoutMs: 50 });
  host.register(TEST_SERVICE_KEY, {
    async flush(): Promise<void> {
      await new Promise((resolve) => setTimeout(resolve, 5));
      flushed = true;
    },
    dispose(): void {
      disposed = true;
    },
  });

  await host.close();

  assert.equal(flushed, true);
  assert.equal(disposed, true);
  assert.equal(host.get(TEST_SERVICE_KEY), null);
});

test('session service host logs and continues after a flush failure', async () => {
  const messages: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => messages.push(args);
  try {
    const host = createWorldSessionServiceHost({ flushTimeoutMs: 50 });
    let disposed = false;
    host.register(TEST_SERVICE_KEY, {
      async flush(): Promise<void> {
        throw new Error('flush failed');
      },
      dispose(): void {
        disposed = true;
      },
    });

    await host.close();

    assert.equal(disposed, true);
    assert.equal(messages.some(([message]) => String(message).includes('flush failed')), true);
  } finally {
    console.error = originalError;
  }
});

test('session service host times out a slow flush and still disposes', async () => {
  const messages: unknown[][] = [];
  const originalError = console.error;
  console.error = (...args: unknown[]) => messages.push(args);
  try {
    const host = createWorldSessionServiceHost({ flushTimeoutMs: 10 });
    let disposed = false;
    host.register(TEST_SERVICE_KEY, {
      async flush(): Promise<void> {
        await new Promise((resolve) => setTimeout(resolve, 30));
      },
      dispose(): void {
        disposed = true;
      },
    });

    const started = Date.now();
    await host.close();
    const elapsed = Date.now() - started;

    assert.equal(disposed, true);
    assert.equal(elapsed < 100, true);
    assert.equal(messages.some(([message]) => String(message).includes('timed out')), true);
  } finally {
    console.error = originalError;
  }
});
