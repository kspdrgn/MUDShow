/**
 * The wire contract shared by surface hosts and surface controllers.
 *
 * Keep this module free of Svelte, Dockview, Tauri, and feature-specific
 * imports. It is deliberately made up of JSON-compatible values so the same
 * messages can cross an in-app or native-window bridge.
 */

export const WORLD_SURFACE_PROTOCOL_VERSION = 1 as const;

export type WorldSurfaceJsonValue =
  | string
  | number
  | boolean
  | null
  | WorldSurfaceJsonValue[]
  | { readonly [key: string]: WorldSurfaceJsonValue };

export type WorldSurfaceJsonObject = Readonly<Record<string, WorldSurfaceJsonValue>>;

export type WorldSurfacePlacement =
  | { host: 'dockview'; mode: 'grid' | 'edge' | 'floating'; edge?: 'top' | 'right' | 'bottom' | 'left' }
  | { host: 'native'; windowId: string };

export interface WorldSurfaceCapabilities {
  canClose: boolean;
  canDock: boolean;
  canFloat: boolean;
  canPopOut: boolean;
  canPopIn: boolean;
  allowsMultipleInstances: boolean;
}

export interface WorldSurfaceDescriptor {
  protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  surfaceId: string;
  rendererId: string;
  title: string;
  capabilities: WorldSurfaceCapabilities;
}

export interface WorldSurfaceSessionKey {
  worldId: string;
  characterId: string | null;
}

export interface WorldSurfaceOpenRequest {
  protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  surface: WorldSurfaceDescriptor;
  instanceId: string;
  sourceSessionKey: WorldSurfaceSessionKey;
  placement?: WorldSurfacePlacement;
  payload?: WorldSurfaceJsonObject;
}

export type WorldSurfaceLifecycleType =
  | 'openRequested'
  | 'opened'
  | 'attached'
  | 'detached'
  | 'placementChanged'
  | 'visibilityChanged'
  | 'resyncRequested'
  | 'invalidated'
  | 'closeRequested'
  | 'closed'
  | 'disposed';

export interface WorldSurfaceLifecycleEvent {
  type: WorldSurfaceLifecycleType;
  placement?: WorldSurfacePlacement;
  visible?: boolean;
  reason?: string;
}

export interface WorldSurfaceLifecycleMessage extends WorldSurfaceLifecycleEvent {
  protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  surfaceId: string;
  instanceId: string;
  revision: number;
}

export interface WorldSurfaceCommand {
  protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  surfaceId: string;
  instanceId: string;
  requestId: string;
  revision: number;
  type: string;
  payload?: WorldSurfaceJsonObject;
}

export interface WorldSurfaceSnapshot {
  protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  surfaceId: string;
  instanceId: string;
  revision: number;
  model: WorldSurfaceJsonValue;
  viewState?: WorldSurfaceJsonValue;
}

export interface WorldSurfaceError {
  protocolVersion: typeof WORLD_SURFACE_PROTOCOL_VERSION;
  surfaceId: string;
  instanceId: string;
  revision: number;
  code: 'invalid-message' | 'stale-command' | 'controller-error' | 'closed';
  message: string;
  requestId?: string;
}

function isFiniteNumber(value: number): boolean {
  return Number.isFinite(value);
}

export function isWorldSurfaceJsonValue(value: unknown, seen = new WeakSet<object>()): value is WorldSurfaceJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return true;
  }

  if (typeof value === 'number') {
    return isFiniteNumber(value);
  }

  if (typeof value !== 'object') {
    return false;
  }

  if (seen.has(value)) {
    return false;
  }
  seen.add(value);

  if (Array.isArray(value)) {
    const valid = value.every((entry) => isWorldSurfaceJsonValue(entry, seen));
    seen.delete(value);
    return valid;
  }

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }

  const valid = Object.values(value).every((entry) => isWorldSurfaceJsonValue(entry, seen));
  seen.delete(value);
  return valid;
}

export function parseWorldSurfaceJsonObject(value: unknown): WorldSurfaceJsonObject | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  return isWorldSurfaceJsonValue(value) ? value as WorldSurfaceJsonObject : null;
}

export function parseWorldSurfaceCommand(value: unknown): WorldSurfaceCommand | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION
    || typeof candidate.surfaceId !== 'string'
    || typeof candidate.instanceId !== 'string'
    || typeof candidate.requestId !== 'string'
    || candidate.requestId.length === 0
    || !Number.isInteger(candidate.revision)
    || (candidate.revision as number) < 0
    || typeof candidate.type !== 'string'
    || candidate.type.length === 0
    || (candidate.payload !== undefined && parseWorldSurfaceJsonObject(candidate.payload) === null)
  ) {
    return null;
  }

  return candidate as unknown as WorldSurfaceCommand;
}

export function parseWorldSurfaceOpenRequest(value: unknown): WorldSurfaceOpenRequest | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const sessionKey = candidate.sourceSessionKey;
  const surface = candidate.surface;
  if (
    candidate.protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION
    || typeof candidate.instanceId !== 'string'
    || candidate.instanceId.length === 0
    || sessionKey === null
    || typeof sessionKey !== 'object'
    || Array.isArray(sessionKey)
    || typeof (sessionKey as Record<string, unknown>).worldId !== 'string'
    || ((sessionKey as Record<string, unknown>).characterId !== null
      && typeof (sessionKey as Record<string, unknown>).characterId !== 'string')
    || surface === null
    || typeof surface !== 'object'
    || Array.isArray(surface)
    || (surface as Record<string, unknown>).protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION
    || typeof (surface as Record<string, unknown>).surfaceId !== 'string'
    || typeof (surface as Record<string, unknown>).rendererId !== 'string'
    || typeof (surface as Record<string, unknown>).title !== 'string'
    || (candidate.payload !== undefined && parseWorldSurfaceJsonObject(candidate.payload) === null)
  ) {
    return null;
  }

  return candidate as unknown as WorldSurfaceOpenRequest;
}

export function parseWorldSurfaceSnapshot(value: unknown): WorldSurfaceSnapshot | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION
    || typeof candidate.surfaceId !== 'string'
    || typeof candidate.instanceId !== 'string'
    || !Number.isInteger(candidate.revision)
    || (candidate.revision as number) < 0
    || !isWorldSurfaceJsonValue(candidate.model)
    || (candidate.viewState !== undefined && !isWorldSurfaceJsonValue(candidate.viewState))
  ) {
    return null;
  }

  return candidate as unknown as WorldSurfaceSnapshot;
}

export function parseWorldSurfaceLifecycleEvent(value: unknown): WorldSurfaceLifecycleEvent | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const lifecycleTypes: WorldSurfaceLifecycleType[] = [
    'openRequested', 'opened', 'attached', 'detached', 'placementChanged',
    'visibilityChanged', 'resyncRequested', 'invalidated', 'closeRequested',
    'closed', 'disposed',
  ];
  if (typeof candidate.type !== 'string' || !lifecycleTypes.includes(candidate.type as WorldSurfaceLifecycleType)) {
    return null;
  }

  if (candidate.visible !== undefined && typeof candidate.visible !== 'boolean') {
    return null;
  }
  if (candidate.reason !== undefined && typeof candidate.reason !== 'string') {
    return null;
  }

  return candidate as unknown as WorldSurfaceLifecycleEvent;
}

export function parseWorldSurfaceLifecycleMessage(value: unknown): WorldSurfaceLifecycleMessage | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  if (
    candidate.protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION
    || typeof candidate.surfaceId !== 'string'
    || typeof candidate.instanceId !== 'string'
    || !Number.isInteger(candidate.revision)
    || (candidate.revision as number) < 0
    || parseWorldSurfaceLifecycleEvent(candidate) === null
  ) {
    return null;
  }

  return candidate as unknown as WorldSurfaceLifecycleMessage;
}

export type WorldSurfaceSnapshotListener = (snapshot: WorldSurfaceSnapshot) => void;
export type WorldSurfaceCommandHandler = (command: WorldSurfaceCommand) => void | Promise<void>;

export interface WorldSurfaceSnapshotStore {
  get(instanceId: string): WorldSurfaceSnapshot | null;
  publish(snapshot: WorldSurfaceSnapshot): boolean;
  subscribe(instanceId: string, listener: WorldSurfaceSnapshotListener): () => void;
  dispose(instanceId: string): void;
}

export interface WorldSurfaceCommandRouter {
  register(instanceId: string, handler: WorldSurfaceCommandHandler): () => void;
  dispatch(instanceId: string, command: WorldSurfaceCommand): boolean;
  dispose(instanceId: string): void;
}

export function createWorldSurfaceSnapshotStore(): WorldSurfaceSnapshotStore {
  const snapshots = new Map<string, WorldSurfaceSnapshot>();
  const listeners = new Map<string, Set<WorldSurfaceSnapshotListener>>();

  return {
    get: (instanceId) => snapshots.get(instanceId) ?? null,
    publish(snapshot) {
      if (snapshot.protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION) {
        return false;
      }

      const current = snapshots.get(snapshot.instanceId);
      if (current && snapshot.revision <= current.revision) {
        return false;
      }

      snapshots.set(snapshot.instanceId, snapshot);
      for (const listener of [...(listeners.get(snapshot.instanceId) ?? [])]) {
        listener(snapshot);
      }
      return true;
    },
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
      if (command.protocolVersion !== WORLD_SURFACE_PROTOCOL_VERSION || command.instanceId !== instanceId) {
        return false;
      }

      const handler = handlers.get(instanceId);
      if (!handler) {
        return false;
      }
      void handler(command);
      return true;
    },
    dispose(instanceId) {
      handlers.delete(instanceId);
    },
  };
}
