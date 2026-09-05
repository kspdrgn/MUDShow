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

export interface WorldPluginServiceBag {
  get<T>(pluginId: string): T | null;
  set<T>(pluginId: string, service: T): void;
}

export interface WorldPluginHostPort {
  invokeAction(pluginId: string, actionId: string): void;
}

export interface WorldPluginSurfaceContribution {
  id: string;
  kind: 'builtin';
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
