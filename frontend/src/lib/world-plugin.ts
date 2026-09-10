import type { CharacterRecord, WorldRecord } from './types.js';
import type { WorldSessionKey } from './world-session-registry.js';
import type { WorldSessionAction } from './world-session-action.js';

export interface WorldPluginActivationContext {
  world: WorldRecord;
  character: CharacterRecord | null;
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

export interface WorldPluginHostPort {
  invokeAction(pluginId: string, actionId: string): void;
  openSurface(pluginId: string, surfaceId: string, payload?: Readonly<Record<string, unknown>>): void;
}

export interface WorldPluginSurfaceContribution {
  id: string;
  kind: 'builtin' | 'plugin';
  protocolVersion: 1;
  rendererId: string;
  defaultTitle: string;
  capabilities: {
    canClose: boolean;
    canDock: boolean;
    canFloat: boolean;
    canPopOut: boolean;
    canPopIn: boolean;
    isModal: boolean;
    allowsMultipleInstances: boolean;
  };
}

export interface WorldPluginSessionContext extends WorldPluginActivationContext {
  sessionKey: WorldSessionKey;
  connection: WorldConnectionPort;
  services: WorldPluginServiceBag;
  host: WorldPluginHostPort;
}

export interface WorldPluginSessionContribution {
  surfaces?: readonly WorldPluginSurfaceContribution[];
  actions?: readonly WorldSessionAction[];
  getActions?: () => readonly WorldSessionAction[];
  subscribe?: (listener: () => void) => () => void;
  onIncomingLine?: (line: string) => void;
  onRawMessage?: (text: string) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  dispose?: () => void | Promise<void>;
}

export interface WorldPlugin {
  id: string;
  label: string;
  dependencies?: readonly string[];
  canActivate(context: WorldPluginActivationContext): boolean;
  createSessionContribution(
    context: WorldPluginSessionContext,
  ): WorldPluginSessionContribution;
}

/**
 * Provider seam shared by built-in plugins and future external adapters.
 * Providers create the existing host plugin contract; loading policy stays outside the registry.
 */
export interface WorldPluginProvider {
  readonly source: 'in-process' | 'external';
  createPlugin(): WorldPlugin;
}

export function createInProcessWorldPluginProvider(
  createPlugin: () => WorldPlugin,
): WorldPluginProvider {
  return {
    source: 'in-process',
    createPlugin,
  };
}
