export type SurfaceId = string;
export type SurfaceInstanceId = string;
export type SurfaceSide = 'view' | 'data' | 'host';

export type SurfaceEnvelopeKind =
  | 'surface.lifecycle'
  | 'surface.view'
  | 'surface.data'
  | 'surface.command'
  | 'surface.snapshot'
  | 'surface.error';

export interface SurfaceEnvelopeBase<K extends SurfaceEnvelopeKind, P> {
  surfaceId: SurfaceId;
  instanceId: SurfaceInstanceId;
  kind: K;
  source: SurfaceSide;
  target?: SurfaceSide;
  revision: number;
  timestamp?: number;
  correlationId?: string;
  payload: P;
}

export type SurfaceLifecycleEvent =
  | { type: 'openRequested' }
  | { type: 'closeRequested' }
  | { type: 'focusRequested' }
  | { type: 'visibilityChanged'; visible: boolean }
  | { type: 'placementChanged'; placement: 'in-app' | 'window' }
  | { type: 'sizeChanged'; width: number; height: number }
  | { type: 'stateReconciled' };

export type SurfaceViewEvent =
  | { type: 'openRequested' }
  | { type: 'closeRequested' }
  | { type: 'selectedChanged'; selectedId: string | null }
  | { type: 'expandedChanged'; expandedIds: string[] }
  | { type: 'scrollChanged'; scrollTop: number; scrollLeft: number; userScrolled: boolean }
  | { type: 'scrollToBottomRequested' }
  | { type: 'followTailChanged'; enabled: boolean };

export type SurfaceDataEvent =
  | { type: 'valueLoaded'; value: string }
  | { type: 'entriesAppended'; entries: unknown[] }
  | { type: 'entriesCleared' }
  | { type: 'rootReplaced'; rootId: string }
  | { type: 'nodeBranchLoaded'; nodeId: string; children: unknown[] }
  | { type: 'nodeLeafLoaded'; nodeId: string; value: unknown }
  | { type: 'saveRequested'; value: string }
  | { type: 'saveCompleted' }
  | { type: 'loadCommandRequested'; nodeId: string };

export type SurfaceCommandEnvelope =
  | SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent>
  | SurfaceEnvelopeBase<'surface.view', SurfaceViewEvent>
  | SurfaceEnvelopeBase<'surface.data', SurfaceDataEvent>
  | SurfaceEnvelopeBase<'surface.command', unknown>;

export type SurfaceSnapshotEnvelope =
  | SurfaceEnvelopeBase<'surface.snapshot', unknown>
  | SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }>;

export interface SurfaceTransportCommandOptions {
  target?: SurfaceSide;
  correlationId?: string;
  timestamp?: number;
  expectedRevision?: number;
}

export interface SurfaceTransportSnapshotOptions {
  target?: SurfaceSide;
  correlationId?: string;
  timestamp?: number;
}

export type SurfaceTransportListener<T> = (envelope: T) => void;
export type SurfaceTransportUnlisten = () => void;

export interface SurfaceTransportSession<CommandPayload, SnapshotPayload> {
  readonly surfaceId: SurfaceId;
  readonly instanceId: SurfaceInstanceId;
  getRevision(): number;
  getSnapshot(): SurfaceEnvelopeBase<'surface.snapshot', SnapshotPayload> | null;
  isClosed(): boolean;
  sendCommand(
    payload: CommandPayload,
    options?: SurfaceTransportCommandOptions,
  ): SurfaceEnvelopeBase<'surface.command', CommandPayload> | null;
  publishSnapshot(
    payload: SnapshotPayload,
    options?: SurfaceTransportSnapshotOptions,
  ): SurfaceEnvelopeBase<'surface.snapshot', SnapshotPayload> | null;
  publishError(message: string, details?: unknown): SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }> | null;
  requestResync(correlationId?: string): SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent> | null;
  onLifecycle(listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent>>): SurfaceTransportUnlisten;
  onCommand(listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.command', CommandPayload>>): SurfaceTransportUnlisten;
  onSnapshot(listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.snapshot', SnapshotPayload>>): SurfaceTransportUnlisten;
  onError(listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }>>): SurfaceTransportUnlisten;
  close(): boolean;
}

export interface SurfaceTransportHubEntry {
  surfaceId: SurfaceId;
  instanceId: SurfaceInstanceId;
  revision: number;
  closed: boolean;
}

export interface SurfaceTransportHub {
  ensureSession<CommandPayload, SnapshotPayload>(
    surfaceId: SurfaceId,
    instanceId: SurfaceInstanceId,
  ): SurfaceTransportSession<CommandPayload, SnapshotPayload>;
  getSession<CommandPayload, SnapshotPayload>(
    instanceId: SurfaceInstanceId,
  ): SurfaceTransportSession<CommandPayload, SnapshotPayload> | null;
  deleteSession(instanceId: SurfaceInstanceId): boolean;
  clear(): void;
  entries(): SurfaceTransportHubEntry[];
}

function createEnvelopeBase<K extends SurfaceEnvelopeKind, P>(
  surfaceId: SurfaceId,
  instanceId: SurfaceInstanceId,
  kind: K,
  source: SurfaceSide,
  payload: P,
  revision: number,
  options: SurfaceTransportCommandOptions | SurfaceTransportSnapshotOptions = {},
): SurfaceEnvelopeBase<K, P> {
  return {
    surfaceId,
    instanceId,
    kind,
    source,
    target: options.target,
    revision,
    timestamp: options.timestamp ?? Date.now(),
    correlationId: options.correlationId,
    payload,
  };
}

function normalizeInstanceId(instanceId: string): string {
  return instanceId.trim();
}

function logSurfaceTransport(message: string, details: Record<string, unknown>): void {
  console.debug(`[surface-transport] ${message}`, details);
}

export function createSurfaceTransportHub(): SurfaceTransportHub {
  const sessions = new Map<string, SurfaceTransportSession<unknown, unknown>>();

  function getExistingSession<CommandPayload, SnapshotPayload>(
    instanceId: SurfaceInstanceId,
  ): SurfaceTransportSession<CommandPayload, SnapshotPayload> | null {
    return (sessions.get(instanceId) ?? null) as SurfaceTransportSession<CommandPayload, SnapshotPayload> | null;
  }

  function deleteSession(instanceId: SurfaceInstanceId): boolean {
    const session = sessions.get(instanceId);
    if (!session) {
      return false;
    }

    sessions.delete(instanceId);
    session.close();
    return true;
  }

  function ensureSession<CommandPayload, SnapshotPayload>(
    surfaceId: SurfaceId,
    instanceId: SurfaceInstanceId,
  ): SurfaceTransportSession<CommandPayload, SnapshotPayload> {
    const normalizedInstanceId = normalizeInstanceId(instanceId);
    const existing = getExistingSession<CommandPayload, SnapshotPayload>(normalizedInstanceId);
    if (existing && existing.surfaceId === surfaceId && !existing.isClosed()) {
      logSurfaceTransport('reuse session', {
        surfaceId,
        instanceId: normalizedInstanceId,
        revision: existing.getRevision(),
      });
      return existing;
    }

    if (existing) {
      logSurfaceTransport('replace stale session', {
        previousSurfaceId: existing.surfaceId,
        surfaceId,
        instanceId: normalizedInstanceId,
      });
      existing.close();
    }

    const commandListeners = new Set<SurfaceTransportListener<SurfaceEnvelopeBase<'surface.command', CommandPayload>>>();
    const lifecycleListeners = new Set<SurfaceTransportListener<SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent>>>();
    const snapshotListeners = new Set<SurfaceTransportListener<SurfaceEnvelopeBase<'surface.snapshot', SnapshotPayload>>>();
    const errorListeners = new Set<SurfaceTransportListener<SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }>>>();
    let revision = 0;
    let lastSnapshot: SurfaceEnvelopeBase<'surface.snapshot', SnapshotPayload> | null = null;
    let closed = false;

    function assertOpen(): boolean {
      return !closed;
    }

    function notify<T>(listeners: Set<SurfaceTransportListener<T>>, envelope: T): void {
      for (const listener of [...listeners]) {
        try {
          listener(envelope);
        } catch (error) {
          console.error('failed to deliver surface transport envelope:', error);
        }
      }
    }

    const session: SurfaceTransportSession<CommandPayload, SnapshotPayload> = {
      surfaceId,
      instanceId: normalizedInstanceId,
      getRevision(): number {
        return revision;
      },
      getSnapshot(): SurfaceEnvelopeBase<'surface.snapshot', SnapshotPayload> | null {
        return lastSnapshot;
      },
      isClosed(): boolean {
        return closed;
      },
      sendCommand(
        payload: CommandPayload,
        options: SurfaceTransportCommandOptions = {},
      ): SurfaceEnvelopeBase<'surface.command', CommandPayload> | null {
        if (!assertOpen()) {
          return null;
        }

        if (options.expectedRevision !== undefined && options.expectedRevision !== revision) {
          return null;
        }

        const envelope = createEnvelopeBase(
          surfaceId,
          normalizedInstanceId,
          'surface.command',
          'view',
          payload,
          revision,
          options,
        );

        logSurfaceTransport('send command', {
          surfaceId,
          instanceId: normalizedInstanceId,
          revision,
          target: options.target ?? null,
          correlationId: options.correlationId ?? null,
          payload,
        });
        notify(commandListeners, envelope);
        return envelope;
      },
      publishSnapshot(
        payload: SnapshotPayload,
        options: SurfaceTransportSnapshotOptions = {},
      ): SurfaceEnvelopeBase<'surface.snapshot', SnapshotPayload> | null {
        if (!assertOpen()) {
          return null;
        }

        revision += 1;
        const envelope = createEnvelopeBase(
          surfaceId,
          normalizedInstanceId,
          'surface.snapshot',
          'host',
          payload,
          revision,
          options,
        );

        lastSnapshot = envelope;
        logSurfaceTransport('publish snapshot', {
          surfaceId,
          instanceId: normalizedInstanceId,
          revision,
          target: options.target ?? null,
          correlationId: options.correlationId ?? null,
        });
        notify(snapshotListeners, envelope);
        return envelope;
      },
      publishError(
        message: string,
        details: unknown = undefined,
      ): SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }> | null {
        if (!assertOpen()) {
          return null;
        }

        const envelope = createEnvelopeBase(
          surfaceId,
          normalizedInstanceId,
          'surface.error',
          'host',
          { message, details },
          revision,
        );

        logSurfaceTransport('publish error', {
          surfaceId,
          instanceId: normalizedInstanceId,
          revision,
          message,
          details: details ?? null,
        });
        notify(errorListeners, envelope);
        return envelope;
      },
      requestResync(correlationId: string | undefined = undefined): SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent> | null {
        if (!assertOpen()) {
          return null;
        }

        const payload: SurfaceLifecycleEvent = { type: 'stateReconciled' };
        const envelope = createEnvelopeBase(
          surfaceId,
          normalizedInstanceId,
          'surface.lifecycle',
          'view',
          payload,
          revision,
          correlationId ? { correlationId } : {},
        );

        logSurfaceTransport('request resync', {
          surfaceId,
          instanceId: normalizedInstanceId,
          revision,
          correlationId: correlationId ?? null,
        });
        notify(lifecycleListeners, envelope);
        return envelope;
      },
      onLifecycle(
        listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.lifecycle', SurfaceLifecycleEvent>>,
      ): SurfaceTransportUnlisten {
        lifecycleListeners.add(listener);
        logSurfaceTransport('add lifecycle listener', {
          surfaceId,
          instanceId: normalizedInstanceId,
          count: lifecycleListeners.size,
        });
        return () => {
          lifecycleListeners.delete(listener);
          logSurfaceTransport('remove lifecycle listener', {
            surfaceId,
            instanceId: normalizedInstanceId,
            count: lifecycleListeners.size,
          });
        };
      },
      onCommand(
        listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.command', CommandPayload>>,
      ): SurfaceTransportUnlisten {
        commandListeners.add(listener);
        logSurfaceTransport('add command listener', {
          surfaceId,
          instanceId: normalizedInstanceId,
          count: commandListeners.size,
        });
        return () => {
          commandListeners.delete(listener);
          logSurfaceTransport('remove command listener', {
            surfaceId,
            instanceId: normalizedInstanceId,
            count: commandListeners.size,
          });
        };
      },
      onSnapshot(
        listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.snapshot', SnapshotPayload>>,
      ): SurfaceTransportUnlisten {
        snapshotListeners.add(listener);
        logSurfaceTransport('add snapshot listener', {
          surfaceId,
          instanceId: normalizedInstanceId,
          count: snapshotListeners.size,
          hasSnapshot: lastSnapshot !== null,
        });
        if (lastSnapshot) {
          listener(lastSnapshot);
        }
        return () => {
          snapshotListeners.delete(listener);
          logSurfaceTransport('remove snapshot listener', {
            surfaceId,
            instanceId: normalizedInstanceId,
            count: snapshotListeners.size,
          });
        };
      },
      onError(
        listener: SurfaceTransportListener<SurfaceEnvelopeBase<'surface.error', { message: string; details?: unknown }>>,
      ): SurfaceTransportUnlisten {
        errorListeners.add(listener);
        logSurfaceTransport('add error listener', {
          surfaceId,
          instanceId: normalizedInstanceId,
          count: errorListeners.size,
        });
        return () => {
          errorListeners.delete(listener);
          logSurfaceTransport('remove error listener', {
            surfaceId,
            instanceId: normalizedInstanceId,
            count: errorListeners.size,
          });
        };
      },
      close(): boolean {
        if (closed) {
          return false;
        }

        closed = true;
        logSurfaceTransport('close session', {
          surfaceId,
          instanceId: normalizedInstanceId,
          revision,
        });
        commandListeners.clear();
        lifecycleListeners.clear();
        snapshotListeners.clear();
        errorListeners.clear();
        return true;
      },
    };

    sessions.set(normalizedInstanceId, session as SurfaceTransportSession<unknown, unknown>);
    logSurfaceTransport('create session', {
      surfaceId,
      instanceId: normalizedInstanceId,
      revision,
    });
    return session;
  }

  return {
    ensureSession,
    getSession<CommandPayload, SnapshotPayload>(instanceId: SurfaceInstanceId): SurfaceTransportSession<CommandPayload, SnapshotPayload> | null {
      return getExistingSession<CommandPayload, SnapshotPayload>(normalizeInstanceId(instanceId));
    },
    deleteSession(instanceId: SurfaceInstanceId): boolean {
      return deleteSession(normalizeInstanceId(instanceId));
    },
    clear(): void {
      for (const instanceId of [...sessions.keys()]) {
        deleteSession(instanceId);
      }
    },
    entries(): SurfaceTransportHubEntry[] {
      return [...sessions.values()].map((session) => ({
        surfaceId: session.surfaceId,
        instanceId: session.instanceId,
        revision: session.getRevision(),
        closed: session.isClosed(),
      }));
    },
  };
}
