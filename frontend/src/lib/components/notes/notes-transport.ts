import type { SurfaceTransportSession } from '../../surfaces/surface-transport';

export interface NotesWindowModel {
  title: string;
  description?: string;
  sourceTabId: string;
  worldId: string;
  characterId: string | null;
  notes: string;
  spellcheckEnabled: boolean;
  spellcheckLanguage: string;
  spellcheckIgnoredWords: string;
  spellcheckSuggestionLimit: number;
  spellcheckMinimumWordLength: number;
  spellcheckDebounceMs: number;
}

export type NotesWindowCommand =
  | { type: 'notesChanged'; notes: string }
  | { type: 'ignoreWordRequested'; word: string }
  | { type: 'closeRequested' };

export interface NotesWindowSnapshot {
  model: NotesWindowModel;
}

export type NotesWindowTransportSession = SurfaceTransportSession<
  NotesWindowCommand,
  NotesWindowSnapshot
>;
