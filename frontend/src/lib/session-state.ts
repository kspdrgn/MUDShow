import type { CharacterDraft, CharacterRecord, HighlightRule, WorldDraft, WorldRecord } from './types';
import type { AppTab } from './tabs';
import type { WorldTabSessionState } from './world-session';

export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'disconnected';
export type DisconnectReason = 'manual' | 'remote' | 'error' | null;
export const DEFAULT_OUTPUT_HISTORY_LINES = 0;

export interface SessionState {
  worlds: WorldRecord[];
  characters: CharacterRecord[];
  highlights: HighlightRule[];
  tabs: AppTab[];
  activeTabId: string | null;
  worldSessions: Record<string, WorldTabSessionState>;
  modalOpen: boolean;
  modalKind: 'world' | 'character' | null;
  modalTitle: string;
  worldEditingIndex: number | null;
  worldModalDraft: WorldDraft;
  editingIndex: number | null;
  modalDraft: CharacterDraft;
  characterWorldId: string | null;
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
};

export function createInitialState(): SessionState {
  return {
    worlds: [],
    characters: [],
    highlights: [],
    tabs: [],
    activeTabId: null,
    worldSessions: {},
    modalOpen: false,
    modalKind: null,
    modalTitle: 'add character',
    worldEditingIndex: null,
    worldModalDraft: { ...INITIAL_WORLD_DRAFT },
    editingIndex: null,
    modalDraft: { ...INITIAL_DRAFT },
    characterWorldId: null,
  };
}
