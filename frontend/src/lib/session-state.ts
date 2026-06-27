import type { Character, CharacterDraft, HighlightRule } from './types';
import { createInputBars, type InputBarConfig, type InputBarId } from './input-bars';

export type Screen = 'list' | 'play';
export type ConnectionStatus = 'idle' | 'connected' | 'error';
export const DEFAULT_OUTPUT_HISTORY_LINES = 0;

export interface SessionState {
  characters: Character[];
  highlights: HighlightRule[];
  inputBars: InputBarConfig[];
  screen: Screen;
  currentCharacter: Character | null;
  outputChunks: string[];
  outputEndsWithBr: boolean;
  userScrolled: boolean;
  activeBar: InputBarId;
  notesVisible: boolean;
  highlightsVisible: boolean;
  connectionStatus: ConnectionStatus;
  hasNewActivity: boolean;
  notes: string;
  modalOpen: boolean;
  modalTitle: string;
  editingIndex: number | null;
  modalDraft: CharacterDraft;
}

export const INITIAL_DRAFT: CharacterDraft = {
  name: '',
  host: '',
  port: '',
  tls: true,
  verifyCertificate: true,
  width: '',
  sound: false,
  outputHistoryLines: String(DEFAULT_OUTPUT_HISTORY_LINES),
};

export function createInitialState(): SessionState {
  return {
    characters: [],
    highlights: [],
    inputBars: createInputBars(1),
    screen: 'list',
    currentCharacter: null,
    outputChunks: [],
    outputEndsWithBr: true,
    userScrolled: false,
    activeBar: 1,
    notesVisible: false,
    highlightsVisible: false,
    connectionStatus: 'idle',
    hasNewActivity: false,
    notes: '',
    modalOpen: false,
    modalTitle: 'add character',
    editingIndex: null,
    modalDraft: { ...INITIAL_DRAFT },
  };
}
