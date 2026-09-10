import {
  WORLD_SURFACE_PROTOCOL_VERSION,
  type WorldSurfaceCommand,
  type WorldSurfaceJsonObject,
  type WorldSurfaceLifecycleEvent,
  type WorldSurfaceLifecycleMessage,
  type WorldSurfaceSnapshot,
} from '../world-surface-protocol.js';

export type SurfaceTransportSide = 'view' | 'controller' | 'host';
export type SurfaceTransportUnlisten = () => void;

export interface SurfaceTransportError {
  code: 'stale-command' | 'closed' | 'controller-error';
  message: string;
  requestId?: string;
}

export interface SurfaceTransportCommandOptions {
  requestId?: string;
  expectedRevision?: number;
  source?: SurfaceTransportSide;
}

export interface SurfaceTransportSession<CommandPayload extends WorldSurfaceJsonObject, SnapshotPayload extends WorldSurfaceJsonObject> {
  readonly surfaceId: string;
  readonly instanceId: string;
  readonly protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  getRevision(): number;
  getSnapshot(): WorldSurfaceSnapshot | null;
  isClosed(): boolean;
  sendCommand(type: string, payload?: CommandPayload, options?: SurfaceTransportCommandOptions): WorldSurfaceCommand | null;
  publishSnapshot(model: SnapshotPayload, viewState?: WorldSurfaceJsonObject): WorldSurfaceSnapshot | null;
  publishError(error: SurfaceTransportError): boolean;
  publishLifecycle(event: WorldSurfaceLifecycleEvent, source?: SurfaceTransportSide): boolean;
  requestResync(requestId?: string): boolean;
  onCommand(listener: (command: WorldSurfaceCommand) => void): SurfaceTransportUnlisten;
  onSnapshot(listener: (snapshot: WorldSurfaceSnapshot) => void): SurfaceTransportUnlisten;
  onLifecycle(listener: (event: WorldSurfaceLifecycleMessage) => void): SurfaceTransportUnlisten;
  onError(listener: (error: SurfaceTransportError) => void): SurfaceTransportUnlisten;
  close(reason?: string): boolean;
}

export interface SurfaceTransportHub {
  ensureSession<CommandPayload extends WorldSurfaceJsonObject, SnapshotPayload extends WorldSurfaceJsonObject>(
    surfaceId: string,
    instanceId: string,
  ): SurfaceTransportSession<CommandPayload, SnapshotPayload>;
  getSession<CommandPayload extends WorldSurfaceJsonObject, SnapshotPayload extends WorldSurfaceJsonObject>(
    instanceId: string,
  ): SurfaceTransportSession<CommandPayload, SnapshotPayload> | null;
  deleteSession(instanceId: string, reason?: string): boolean;
  clear(): void;
}

function createRequestId(): string {
  return `surface-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function notify<T>(listeners: Set<(value: T) => void>, value: T): void {
  for (const listener of [...listeners]) {
    try {
      listener(value);
    } catch {
      // A broken consumer must not prevent another host/controller listener
      // from receiving the protocol message.
    }
  }
}

export function createSurfaceTransportHub(): SurfaceTransportHub {
  const sessions = new Map<string, SurfaceTransportSession<WorldSurfaceJsonObject, WorldSurfaceJsonObject>>();

  function ensureSession<CommandPayload extends WorldSurfaceJsonObject, SnapshotPayload extends WorldSurfaceJsonObject>(
    surfaceId: string,
    instanceId: string,
  ): SurfaceTransportSession<CommandPayload, SnapshotPayload> {
    const normalizedInstanceId = instanceId.trim();
    if (!normalizedInstanceId) {
      throw new Error('surface instance id must not be empty');
    }

    const existing = sessions.get(normalizedInstanceId);
    if (existing && existing.surfaceId === surfaceId && !existing.isClosed()) {
      return existing as SurfaceTransportSession<CommandPayload, SnapshotPayload>;
    }
    existing?.close('replaced by a newer surface instance');

    const commandListeners = new Set<(command: WorldSurfaceCommand) => void>();
    const snapshotListeners = new Set<(snapshot: WorldSurfaceSnapshot) => void>();
    const lifecycleListeners = new Set<(event: WorldSurfaceLifecycleMessage) => void>();
    const errorListeners = new Set<(error: SurfaceTransportError) => void>();
    let revision = 0;
    let snapshot: WorldSurfaceSnapshot | null = null;
    let closed = false;

    function lifecycleMessage(event: WorldSurfaceLifecycleEvent): WorldSurfaceLifecycleMessage {
      return {
        ...event,
        protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
        surfaceId,
        instanceId: normalizedInstanceId,
        revision,
      };
    }

    const session: SurfaceTransportSession<WorldSurfaceJsonObject, WorldSurfaceJsonObject> = {
      surfaceId,
      instanceId: normalizedInstanceId,
      protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
      getRevision: () => revision,
      getSnapshot: () => snapshot,
      isClosed: () => closed,
      sendCommand(type, payload, options = {}) {
        if (closed) {
          notify(errorListeners, { code: 'closed', message: 'surface session is closed', requestId: options.requestId });
          return null;
        }
        if (options.expectedRevision !== undefined && options.expectedRevision !== revision) {
          notify(errorListeners, {
            code: 'stale-command',
            message: `command revision ${options.expectedRevision} does not match current revision ${revision}`,
            requestId: options.requestId,
          });
          return null;
        }

        const command: WorldSurfaceCommand = {
          protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
          surfaceId,
          instanceId: normalizedInstanceId,
          requestId: options.requestId ?? createRequestId(),
          revision,
          type,
          ...(payload === undefined ? {} : { payload }),
        };
        notify(commandListeners, command);
        return command;
      },
      publishSnapshot(model, viewState) {
        if (closed) {
          notify(errorListeners, { code: 'closed', message: 'surface session is closed' });
          return null;
        }
        revision += 1;
        snapshot = {
          protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
          surfaceId,
          instanceId: normalizedInstanceId,
          revision,
          model,
          ...(viewState === undefined ? {} : { viewState }),
        };
        notify(snapshotListeners, snapshot);
        return snapshot;
      },
      publishError(error) {
        if (closed) {
          return false;
        }
        notify(errorListeners, error);
        return true;
      },
      publishLifecycle(event, _source = 'host') {
        if (closed && event.type !== 'closed' && event.type !== 'disposed') {
          return false;
        }
        notify(lifecycleListeners, lifecycleMessage(event));
        return true;
      },
      requestResync(requestId) {
        if (closed) {
          return false;
        }
        notify(lifecycleListeners, lifecycleMessage({ type: 'resyncRequested', reason: requestId }));
        return true;
      },
      onCommand(listener) {
        commandListeners.add(listener);
        return () => commandListeners.delete(listener);
      },
      onSnapshot(listener) {
        snapshotListeners.add(listener);
        if (snapshot) {
          listener(snapshot);
        }
        return () => snapshotListeners.delete(listener);
      },
      onLifecycle(listener) {
        lifecycleListeners.add(listener);
        if (!closed) {
          listener(lifecycleMessage({ type: 'opened' }));
        }
        return () => lifecycleListeners.delete(listener);
      },
      onError(listener) {
        errorListeners.add(listener);
        return () => errorListeners.delete(listener);
      },
      close(reason = 'surface closed') {
        if (closed) {
          return false;
        }
        notify(lifecycleListeners, lifecycleMessage({ type: 'closed', reason }));
        closed = true;
        commandListeners.clear();
        snapshotListeners.clear();
        lifecycleListeners.clear();
        errorListeners.clear();
        return true;
      },
    };

    sessions.set(normalizedInstanceId, session);
    notify(lifecycleListeners, lifecycleMessage({ type: 'opened' }));
    return session as SurfaceTransportSession<CommandPayload, SnapshotPayload>;
  }

  return {
    ensureSession,
    getSession(instanceId) {
      return (sessions.get(instanceId.trim()) ?? null) as SurfaceTransportSession<WorldSurfaceJsonObject, WorldSurfaceJsonObject> | null;
    },
    deleteSession(instanceId, reason) {
      const session = sessions.get(instanceId.trim());
      if (!session) {
        return false;
      }
      sessions.delete(instanceId.trim());
      session.close(reason ?? 'surface session deleted');
      return true;
    },
    clear() {
      for (const instanceId of [...sessions.keys()]) {
        const session = sessions.get(instanceId);
        sessions.delete(instanceId);
        session?.close('surface transport cleared');
      }
    },
  };
}
