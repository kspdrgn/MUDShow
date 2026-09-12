import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptsConnectionSequence, acceptsConnectionSnapshot, MudConnection } from '../connection';

test('connection live ordering rejects duplicates and stale events', () => {
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

test('attach installs the listener before requesting buffered data and orders snapshot/live events', async () => {
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
    onSnapshot: () => received.push('snapshot'),
    onClose: () => received.push('close'),
    onError: (message) => received.push(`error:${message}`),
  });

  assert.deepEqual(calls, []);
  mock.emit({ connectionId: 'connection-1', sequence: 6, kind: 'data', text: 'during attach' });
  replayResolve({
    contractVersion: 1,
    runtimeId: 'runtime-1',
    connectionId: 'connection-1',
    sessionId: 1,
    snapshotRevision: 1,
    eventSequence: 4,
    snapshot: {
      connectionStatus: 'connected',
      lastError: null,
      negotiatedCapabilities: [],
      protocolState: null,
      diagnostics: [],
    },
    events: [
      { sequence: 5, kind: 'data', text: 'replayed' },
    ],
  });
  await attach;

  assert.deepEqual(calls, ['attach_mud_connection']);
  assert.deepEqual(received, ['snapshot', 'open', 'replayed', 'during attach']);
  mock.emit({ connectionId: 'connection-1', sequence: 7, kind: 'data', text: 'live' });
  assert.deepEqual(received, ['snapshot', 'open', 'replayed', 'during attach', 'live']);
});

test('stale attach events are ignored after detach', async () => {
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
  replayResolve({
    contractVersion: 1,
    runtimeId: 'runtime-1',
    connectionId: 'connection-2',
    sessionId: 1,
    snapshotRevision: 1,
    eventSequence: 0,
    snapshot: {
      connectionStatus: 'connected',
      lastError: null,
      negotiatedCapabilities: [],
      protocolState: null,
      diagnostics: [],
    },
    events: [{ sequence: 1, sessionId: 1, kind: 'data', text: 'stale' }],
  });
  await attach;

  assert.deepEqual(received, []);
  assert.equal(mock.unlistenCount, 1);
});

test('attach ignores events from a replacement backend session with the same connection id', async () => {
  let replayResolve!: (value: unknown) => void;
  const replayPromise = new Promise((resolve) => {
    replayResolve = resolve;
  });
  const mock = installTauriMock(async (command) => command === 'attach_mud_connection' ? replayPromise : undefined);
  const connection = new MudConnection('connection-replaced');
  const received: string[] = [];
  const attach = connection.attach({
    onOpen: () => received.push('open'),
    onRawMessage: () => undefined,
    onMessage: (text) => received.push(text),
    onClose: () => received.push('close'),
    onError: (message) => received.push(`error:${message}`),
  });

  mock.emit({ connectionId: 'connection-replaced', sessionId: 1, sequence: 9, kind: 'data', text: 'old session' });
  replayResolve({
    contractVersion: 1,
    runtimeId: 'runtime-1',
    connectionId: 'connection-replaced',
    sessionId: 2,
    snapshotRevision: 1,
    eventSequence: 8,
    snapshot: {
      connectionStatus: 'connected',
      lastError: null,
      negotiatedCapabilities: [],
      protocolState: null,
      diagnostics: [],
    },
    events: [{ sequence: 8, sessionId: 2, kind: 'data', text: 'current session' }],
  });
  await attach;
  mock.emit({ connectionId: 'connection-replaced', sessionId: 1, sequence: 10, kind: 'data', text: 'old session later' });
  mock.emit({ connectionId: 'connection-replaced', sessionId: 2, sequence: 11, kind: 'data', text: 'current session later' });

  assert.deepEqual(received, ['open', 'current session', 'current session later']);
});

test('attach failure reports a frontend recovery diagnostic', async () => {
  installTauriMock(async (command) => {
    if (command === 'attach_mud_connection') {
      throw new Error('backend session expired');
    }
    return undefined;
  });
  const connection = new MudConnection('connection-expired');
  const errors: string[] = [];

  await connection.attach({
    onOpen: () => undefined,
    onRawMessage: () => undefined,
    onMessage: () => undefined,
    onClose: () => undefined,
    onError: (message) => errors.push(message),
  });

  assert.deepEqual(errors, ['backend session expired']);
});

test('frontend detach preserves the backend connection for its grace period', async () => {
  let detachArgs: Record<string, unknown> | undefined;
  installTauriMock(async (command, args) => {
    if (command === 'detach_mud_connection') {
      detachArgs = args;
    }
    return undefined;
  });
  const connection = new MudConnection('connection-detach');

  await connection.detach(12_345);

  assert.deepEqual(detachArgs, {
    connectionId: 'connection-detach',
    gracePeriodMs: 12_345,
  });
});

test('close disconnects instead of preserving the backend connection', async () => {
  const calls: string[] = [];
  installTauriMock(async (command) => {
    calls.push(command);
    return undefined;
  });
  const connection = new MudConnection('connection-close');

  await connection.close();

  assert.deepEqual(calls, ['disconnect_mud']);
});

test('connection snapshot recovery never moves sequence state backward', () => {
  assert.equal(acceptsConnectionSnapshot(4, 4), true);
  assert.equal(acceptsConnectionSnapshot(4, 7), true);
  assert.equal(acceptsConnectionSnapshot(7, 4), false);
});
