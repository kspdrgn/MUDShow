import type {
  CharacterDraft,
  CharacterRecord,
  Trigger,
  WorldDraft,
  WorldRecord,
} from './types';
import type { AppTab, SettingsSubTabId } from './tabs';
import type { WorldTabSessionState } from './world-session';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';
export type DisconnectReason = 'manual' | 'remote' | 'error' | null;
export const DEFAULT_OUTPUT_HISTORY_LINES = 0;

export interface SessionState {
  worlds: WorldRecord[];
  characters: CharacterRecord[];
  triggers: Trigger[];
  tabs: AppTab[];
  activeTabId: string | null;
  worldSessions: Record<string, WorldTabSessionState>;
  modalOpen: boolean;
  modalKind: 'world' | 'character' | null;
  modalTitle: string;
  closeConfirmTabId: string | null;
  closeConfirmMode: 'modal' | 'dropdown' | null;
  confirmUnloggedTabClose: boolean;
  worldEditingId: string | null;
  worldModalDraft: WorldDraft;
  editingIndex: number | null;
  modalDraft: CharacterDraft;
  characterWorldId: string | null;
  settingsActiveTab: SettingsSubTabId;
  triggersContextWorldId: string | null;
  triggersContextCharacterId: string | null;
}

export const INITIAL_WORLD_DRAFT: WorldDraft = {
  name: '',
  host: '',
  port: '',
  tls: true,
  verifyCertificate: true,
};

export const INITIAL_DRAFT: CharacterDraft = {
  name: '',
  width: '',
  sound: false,
  outputHistoryLines: String(DEFAULT_OUTPUT_HISTORY_LINES),
  connectString: '',
};

export function createInitialState(): SessionState {
  return {
    worlds: [],
    characters: [],
    triggers: [],
    tabs: [],
    activeTabId: null,
    worldSessions: {},
    modalOpen: false,
    modalKind: null,
    modalTitle: 'add character',
    closeConfirmTabId: null,
    closeConfirmMode: null,
    confirmUnloggedTabClose: false,
    worldEditingId: null,
    worldModalDraft: { ...INITIAL_WORLD_DRAFT },
    editingIndex: null,
    modalDraft: { ...INITIAL_DRAFT },
    characterWorldId: null,
    settingsActiveTab: 'database',
    triggersContextWorldId: null,
    triggersContextCharacterId: null,
  };
}
