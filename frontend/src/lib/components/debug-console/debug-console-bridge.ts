import { emit, listen } from '../../tauri';
import type {
  SurfaceEnvelopeBase,
  SurfaceInstanceId,
  SurfaceId,
  SurfaceLifecycleEvent,
  SurfaceTransportCommandOptions,
  SurfaceTransportListener,
  SurfaceTransportSession,
  SurfaceTransportSnapshotOptions,
  SurfaceTransportUnlisten,
} from '../../surfaces/surface-transport';
import type {
  DebugConsoleWindowCommand,
  DebugConsoleWindowSnapshot,
} from './debug-console-transport';

const BRIDGE_COMMAND_EVENT = 'surface-transport:command';
const BRIDGE_LIFECYCLE_EVENT = 'surface-transport:lifecycle';
const BRIDGE_SNAPSHOT_EVENT_PREFIX = 'surface-transport:snapshot:';

export interface SurfaceTransportBridgeCommandEnvelope<CommandPayload>
  extends SurfaceEnvelopeBase<'surface.command', CommandPayload> {
  expectedRevision?: number;
}

export interface SurfaceTransportBridgeLifecycleEnvelope
  extends SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent> {
  expectedRevision?: number;
}

export type DebugConsoleBridgeSession = SurfaceTransportSession<
  DebugConsoleWindowCommand,
  DebugConsoleWindowSnapshot
>;

export function getDebugConsoleBridgeSnapshotEventName(instanceId: SurfaceInstanceId): string {
  return `${BRIDGE_SNAPSHOT_EVENT_PREFIX}${instanceId}`;
}

export function isDebugConsoleBridgeCommandEnvelope(
  envelope: SurfaceEnvelopeBase<'surface.command', DebugConsoleWindowCommand> | SurfaceTransportBridgeLifecycleEnvelope,
): envelope is SurfaceTransportBridgeCommandEnvelope<DebugConsoleWindowCommand> {
  return envelope.kind === 'surface.command';
}

export function isDebugConsoleBridgeLifecycleEnvelope(
  envelope: SurfaceEnvelopeBase<'surface.command', DebugConsoleWindowCommand> | SurfaceTransportBridgeLifecycleEnvelope,
): envelope is SurfaceTransportBridgeLifecycleEnvelope {
  return envelope.kind === 'surface.lifecycle';
}

export function createDebugConsoleBridgeSession(
  surfaceId: SurfaceId,
  instanceId: SurfaceInstanceId,
): DebugConsoleBridgeSession {
  const snapshotListeners = new Set<
    SurfaceTransportListener<SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot>>
  >();
  const lifecycleListeners = new Set<
    SurfaceTransportListener<SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent>>
  >();
  const commandListeners = new Set<
    SurfaceTransportListener<SurfaceEnvelopeBase<'surface.command', DebugConsoleWindowCommand>>
  >();
  const errorListeners = new Set<
    SurfaceTransportListener<SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }>>
  >();
  let revision = 0;
  let lastSnapshot: SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot> | null = null;
  let closed = false;
  let unlistenSnapshot: SurfaceTransportUnlisten | null = null;

  function log(message: string, details: Record<string, unknown>): void {
    console.debug(`[surface-bridge] ${message}`, details);
  }

  function notify<T>(listeners: Set<SurfaceTransportListener<T>>, envelope: T): void {
    for (const listener of [...listeners]) {
      try {
        listener(envelope);
      } catch (error) {
        console.error('failed to deliver surface bridge envelope:', error);
      }
    }
  }

  async function ensureSnapshotListener(): Promise<void> {
    if (unlistenSnapshot) {
      return;
    }

    unlistenSnapshot = await listen<SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot>>(
      getDebugConsoleBridgeSnapshotEventName(instanceId),
      (event) => {
        if (closed) {
          return;
        }

        lastSnapshot = event.payload;
        revision = event.payload.revision;
        log('snapshot received', {
          surfaceId,
          instanceId,
          revision,
          entryCount: event.payload.payload.model.entries.length,
        });
        notify(snapshotListeners, event.payload);
      },
    );
  }

  void ensureSnapshotListener().then(() => {
    if (!closed && !lastSnapshot) {
      void (async () => {
        const request = envelopeForResync(surfaceId, instanceId, revision);
        log('initial resync requested', {
          surfaceId,
          instanceId,
          revision,
        });
        await emit(BRIDGE_LIFECYCLE_EVENT, request);
      })();
    }
  });

  return {
    surfaceId,
    instanceId,
    getRevision(): number {
      return revision;
    },
    getSnapshot(): SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot> | null {
      return lastSnapshot;
    },
    isClosed(): boolean {
      return closed;
    },
    sendCommand(
      payload: DebugConsoleWindowCommand,
      options: SurfaceTransportCommandOptions = {},
    ): SurfaceEnvelopeBase<'surface.command', DebugConsoleWindowCommand> | null {
      if (closed) {
        return null;
      }

      const envelope: SurfaceTransportBridgeCommandEnvelope<DebugConsoleWindowCommand> = {
        surfaceId,
        instanceId,
        kind: 'surface.command',
        source: 'view',
        target: options.target,
        revision: options.expectedRevision ?? revision,
        timestamp: options.timestamp ?? Date.now(),
        correlationId: options.correlationId,
        payload,
        expectedRevision: options.expectedRevision,
      };

      log('send command', {
        surfaceId,
        instanceId,
        revision: envelope.revision,
        expectedRevision: options.expectedRevision ?? null,
        payload,
      });
      void emit(BRIDGE_COMMAND_EVENT, envelope);
      notify(commandListeners, envelope);
      return envelope;
    },
    publishSnapshot(
      payload: DebugConsoleWindowSnapshot,
      options: SurfaceTransportSnapshotOptions = {},
    ): SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot> | null {
      if (closed) {
        return null;
      }

      revision = options.timestamp ? revision : revision + 1;
      const envelope: SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot> = {
        surfaceId,
        instanceId,
        kind: 'surface.snapshot',
        source: 'host',
        target: options.target,
        revision,
        timestamp: options.timestamp ?? Date.now(),
        correlationId: options.correlationId,
        payload,
      };

      lastSnapshot = envelope;
      log('publish snapshot locally', {
        surfaceId,
        instanceId,
        revision,
        entryCount: payload.model.entries.length,
      });
      notify(snapshotListeners, envelope);
      return envelope;
    },
    publishError(
      message: string,
      details: unknown = undefined,
    ): SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }> | null {
      if (closed) {
        return null;
      }

      const envelope: SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }> = {
        surfaceId,
        instanceId,
        kind: 'surface.error',
        source: 'host',
        revision,
        timestamp: Date.now(),
        payload: { message, details },
      };

      notify(errorListeners, envelope);
      return envelope;
    },
    requestResync(correlationId: string | undefined = undefined): SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent> | null {
      if (closed) {
        return null;
      }

      const envelope: SurfaceTransportBridgeLifecycleEnvelope = {
        surfaceId,
        instanceId,
        kind: 'surface.lifecycle',
        source: 'view',
        revision,
        timestamp: Date.now(),
        correlationId,
        payload: { type: 'stateReconciled' },
      };

      log('request resync', {
        surfaceId,
        instanceId,
        revision,
        correlationId: correlationId ?? null,
      });
      void emit(BRIDGE_LIFECYCLE_EVENT, envelope);
      notify(lifecycleListeners, envelope);
      return envelope;
    },
    onLifecycle(
      listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent>>,
    ): SurfaceTransportUnlisten {
      lifecycleListeners.add(listener);
      return () => {
        lifecycleListeners.delete(listener);
      };
    },
    onCommand(
      listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.command', DebugConsoleWindowCommand>>,
    ): SurfaceTransportUnlisten {
      commandListeners.add(listener);
      return () => {
        commandListeners.delete(listener);
      };
    },
    onSnapshot(
      listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot>>,
    ): SurfaceTransportUnlisten {
      snapshotListeners.add(listener);
      if (lastSnapshot) {
        listener(lastSnapshot);
      }
      return () => {
        snapshotListeners.delete(listener);
      };
    },
    onError(
      listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }>>,
    ): SurfaceTransportUnlisten {
      errorListeners.add(listener);
      return () => {
        errorListeners.delete(listener);
      };
    },
    close(): boolean {
      if (closed) {
        return false;
      }

      closed = true;
      void unlistenSnapshot?.();
      unlistenSnapshot = null;
      snapshotListeners.clear();
      lifecycleListeners.clear();
      commandListeners.clear();
      errorListeners.clear();
      return true;
    },
  };
}

function envelopeForResync(
  surfaceId: SurfaceId,
  instanceId: SurfaceInstanceId,
  revision: number,
): SurfaceTransportBridgeLifecycleEnvelope {
  return {
    surfaceId,
    instanceId,
    kind: 'surface.lifecycle',
    source: 'view',
    revision,
    timestamp: Date.now(),
    payload: { type: 'stateReconciled' },
  };
}
