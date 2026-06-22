import type { Character, CharacterDraft, HighlightRule } from './types';
import { loadCharacters, loadHighlights } from './storage';

export type Screen = 'list' | 'play';
export type ConnectionStatus = 'idle' | 'connected' | 'error';

export interface SessionState {
  characters: Character[];
  highlights: HighlightRule[];
  screen: Screen;
  currentCharacter: Character | null;
  outputChunks: string[];
  outputEndsWithBr: boolean;
  userScrolled: boolean;
  activeBar: 1 | 2;
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
};

export function createInitialState(): SessionState {
  return {
    characters: loadCharacters(),
    highlights: loadHighlights(),
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
