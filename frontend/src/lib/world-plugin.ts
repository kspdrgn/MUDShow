import type { CharacterRecord, WorldRecord } from './types.js';
import type { WorldSessionAction } from './world-session-action.js';
import type { WorldSurfaceDescriptor } from './world-surface-protocol.js';

export interface WorldSessionKey {
  worldId: string;
  characterId: string | null;
}

export interface WorldConnectionPort {
  send(command: string): void;
}

export interface WorldPluginServiceKey<T> {
  readonly id: string;
  readonly __serviceType?: (service: T) => T;
}

export function createWorldPluginServiceKey<T>(id: string): WorldPluginServiceKey<T> {
  return { id };
}

export interface WorldPluginServiceBag {
  get<T>(key: WorldPluginServiceKey<T>): T | null;
  set<T>(key: WorldPluginServiceKey<T>, service: T): void;
}

export interface WorldSurfaceHostPort {
  openSurface(pluginId: string, surface: WorldSurfaceDescriptor, payload?: Readonly<Record<string, unknown>>): string;
}

export interface WorldPluginActivationContext {
  world: WorldRecord;
  character: CharacterRecord | null;
}

export interface WorldPluginSessionContext extends WorldPluginActivationContext {
  sessionKey: WorldSessionKey;
  connection: WorldConnectionPort;
  services: WorldPluginServiceBag;
  host: WorldSurfaceHostPort;
}

export interface WorldPluginSessionContribution {
  actions?: readonly WorldSessionAction[];
  getActions?: () => readonly WorldSessionAction[];
  surfaces?: readonly WorldSurfaceDescriptor[];
  subscribe?: (listener: () => void) => () => void;
  onIncomingLine?: (line: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  dispose?: () => void | Promise<void>;
}

export interface WorldPlugin {
  id: string;
  label: string;
  dependencies?: readonly string[];
  canActivate(context: WorldPluginActivationContext): boolean;
  createSessionContribution(context: WorldPluginSessionContext): WorldPluginSessionContribution;
}
