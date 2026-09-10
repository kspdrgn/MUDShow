export const WORLD_SURFACE_PROTOCOL_VERSION = 1 as const;

export type WorldSurfaceJsonValue =
  | string
  | number
  | boolean
  | null
  | WorldSurfaceJsonValue[]
  | { readonly [key: string]: WorldSurfaceJsonValue };

export type WorldSurfacePayload = Readonly<Record<string, WorldSurfaceJsonValue>>;

export interface WorldSurfaceOpenRequest {
  protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  surfaceId: string;
  instanceId: string;
  sourceSessionKey: Readonly<{
    worldId: string;
    characterId: string | null;
  }>;
  payload?: WorldSurfacePayload;
}

export interface WorldSurfaceCommand {
  type: string;
  revision?: number;
  payload?: WorldSurfacePayload;
}

export interface WorldSurfaceSnapshot {
  protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  surfaceId: string;
  instanceId: string;
  revision: number;
  model: WorldSurfaceJsonValue;
  viewState?: WorldSurfaceJsonValue;
}

export function isWorldSurfaceJsonValue(value: unknown): value is WorldSurfaceJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return true;
  }

  if (Array.isArray(value)) {
    return value.every((entry) => isWorldSurfaceJsonValue(entry));
  }

  if (typeof value !== 'object') {
    return false;
  }

  return Object.values(value).every((entry) => isWorldSurfaceJsonValue(entry));
}

export function parseWorldSurfacePayload(value: unknown): WorldSurfacePayload | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return Object.values(value).every((entry) => isWorldSurfaceJsonValue(entry))
    ? value as WorldSurfacePayload
    : null;
}

export function parseWorldSurfaceCommand(value: unknown): WorldSurfaceCommand | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (typeof candidate.type !== 'string' || candidate.type.length === 0) {
    return null;
  }

  if (candidate.revision !== undefined
    && (!Number.isInteger(candidate.revision) || (candidate.revision as number) < 0)) {
    return null;
  }

  if (candidate.payload !== undefined && parseWorldSurfacePayload(candidate.payload) === null) {
    return null;
  }

  return {
    type: candidate.type,
    ...(candidate.revision === undefined ? {} : { revision: candidate.revision as number }),
    ...(candidate.payload === undefined ? {} : { payload: candidate.payload as WorldSurfacePayload }),
  };
}

export function parseWorldSurfaceSnapshot(value: unknown): WorldSurfaceSnapshot | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (candidate.protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION
    || typeof candidate.surfaceId !== 'string'
    || typeof candidate.instanceId !== 'string'
    || !Number.isInteger(candidate.revision)
    || (candidate.revision as number) < 0
    || !isWorldSurfaceJsonValue(candidate.model)
    || (candidate.viewState !== undefined && !isWorldSurfaceJsonValue(candidate.viewState))) {
    return null;
  }

  return candidate as unknown as WorldSurfaceSnapshot;
}

export type WorldSurfaceSnapshotListener = (snapshot: WorldSurfaceSnapshot) => void;

export interface WorldSurfaceSnapshotStore {
  get(instanceId: string): WorldSurfaceSnapshot | null;
  publish(snapshot: WorldSurfaceSnapshot): void;
  subscribe(instanceId: string, listener: WorldSurfaceSnapshotListener): () => void;
  dispose(instanceId: string): void;
}

export type WorldSurfaceCommandHandler = (command: WorldSurfaceCommand) => void;

export interface WorldSurfaceCommandRouter {
  register(instanceId: string, handler: WorldSurfaceCommandHandler): () => void;
  dispatch(instanceId: string, command: WorldSurfaceCommand): boolean;
  dispose(instanceId: string): void;
}

export function createWorldSurfaceSnapshotStore(): WorldSurfaceSnapshotStore {
  const snapshots = new Map<string, WorldSurfaceSnapshot>();
  const listeners = new Map<string, Set<WorldSurfaceSnapshotListener>>();

  function publish(snapshot: WorldSurfaceSnapshot): void {
    if (snapshot.protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION) {
      throw new Error(`unsupported world surface protocol version: ${snapshot.protocolVersion}`);
    }

    const current = snapshots.get(snapshot.instanceId);
    if (current && snapshot.revision <= current.revision) {
      return;
    }

    snapshots.set(snapshot.instanceId, snapshot);
    listeners.get(snapshot.instanceId)?.forEach((listener) => listener(snapshot));
  }

  return {
    get: (instanceId) => snapshots.get(instanceId) ?? null,
    publish,
    subscribe(instanceId, listener) {
      const instanceListeners = listeners.get(instanceId) ?? new Set<WorldSurfaceSnapshotListener>();
      instanceListeners.add(listener);
      listeners.set(instanceId, instanceListeners);
      return () => {
        instanceListeners.delete(listener);
        if (instanceListeners.size === 0) {
          listeners.delete(instanceId);
        }
      };
    },
    dispose(instanceId) {
      snapshots.delete(instanceId);
      listeners.delete(instanceId);
    },
  };
}

export function createWorldSurfaceCommandRouter(): WorldSurfaceCommandRouter {
  const handlers = new Map<string, WorldSurfaceCommandHandler>();

  return {
    register(instanceId, handler) {
      handlers.set(instanceId, handler);
      return () => {
        if (handlers.get(instanceId) === handler) {
          handlers.delete(instanceId);
        }
      };
    },
    dispatch(instanceId, command) {
      const handler = handlers.get(instanceId);
      if (!handler) {
        return false;
      }
      handler(command);
      return true;
    },
    dispose(instanceId) {
      handlers.delete(instanceId);
    },
  };
}
