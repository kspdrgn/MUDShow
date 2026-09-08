import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptsConnectionSequence, MudConnection } from '../connection';

test('connection replay/live ordering rejects duplicates and stale events', () => {
  assert.equal(acceptsConnectionSequence(0, 1), true);
  assert.equal(acceptsConnectionSequence(1, 1), false);
  assert.equal(acceptsConnectionSequence(4, 3), false);
  assert.equal(acceptsConnectionSequence(4, 5), true);
  assert.equal(acceptsConnectionSequence(4, undefined), true);
});

type FakeListener = (event: { payload: Record<string, unknown> }) => void;

function installTauriMock(invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>) {
  let listener: FakeListener | null = null;
  let unlistenCount = 0;
  (globalThis as unknown as { window: Record<string, unknown> }).window = {
    __TAURI_INTERNALS__: { invoke },
    __TAURI__: {
      event: {
        listen: async (_event: string, handler: FakeListener) => {
          listener = handler;
          return () => {
            listener = null;
            unlistenCount += 1;
          };
        },
      },
    },
  };

  return {
    emit(payload: Record<string, unknown>) {
      listener?.({ payload });
    },
    get unlistenCount() {
      return unlistenCount;
    },
  };
}

test('attach installs the listener before requesting replay and orders replay/live events', async () => {
  const calls: string[] = [];
  let replayResolve!: (value: unknown) => void;
  const replayPromise = new Promise((resolve) => {
    replayResolve = resolve;
  });
  const mock = installTauriMock(async (command) => {
    calls.push(command);
    if (command === 'attach_mud_connection') {
      return replayPromise;
    }
    return undefined;
  });
  const connection = new MudConnection('connection-1');
  const received: string[] = [];

  const attach = connection.attach({
    onOpen: () => received.push('open'),
    onRawMessage: () => undefined,
    onMessage: (text) => received.push(text),
    onClose: () => received.push('close'),
    onError: (message) => received.push(`error:${message}`),
  }, 4);

  assert.deepEqual(calls, []);
  replayResolve({
    events: [
      { sequence: 5, kind: 'data', text: 'replayed' },
      { sequence: 6, kind: 'opened' },
    ],
    oldestSequence: 5,
    newestSequence: 6,
    hasGap: false,
  });
  await attach;

  assert.deepEqual(calls, ['attach_mud_connection']);
  assert.deepEqual(received, ['replayed', 'open']);
  mock.emit({ connectionId: 'connection-1', sequence: 7, kind: 'data', text: 'live' });
  assert.deepEqual(received, ['replayed', 'open', 'live']);
});

test('stale replay events are ignored after detach', async () => {
  let replayResolve!: (value: unknown) => void;
  const replayPromise = new Promise((resolve) => {
    replayResolve = resolve;
  });
  const mock = installTauriMock(async (command) => command === 'attach_mud_connection' ? replayPromise : undefined);
  const connection = new MudConnection('connection-2');
  const received: string[] = [];
  const attach = connection.attach({
    onOpen: () => received.push('open'),
    onRawMessage: () => undefined,
    onMessage: (text) => received.push(text),
    onClose: () => received.push('close'),
    onError: (message) => received.push(`error:${message}`),
  });

  connection.detach();
  replayResolve({ events: [{ sequence: 1, kind: 'data', text: 'stale' }], oldestSequence: 1, newestSequence: 1, hasGap: false });
  await attach;

  assert.deepEqual(received, []);
  assert.equal(mock.unlistenCount, 1);
});
