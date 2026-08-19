import type { NotesWindowModel } from './notes-transport';

export interface NotesWindowSourceState {
  sourceTabId: string;
  worldId: string;
  characterId: string | null;
  title: string;
  description?: string;
  notes: string;
}

export interface NotesWindowSpellcheckConfig {
  enabled: boolean;
  language: string;
  ignoredWords: string;
  suggestionLimit: number;
  minimumWordLength: number;
  debounceMs: number;
}

export function buildNotesWindowModel(
  source: NotesWindowSourceState,
  spellcheck: NotesWindowSpellcheckConfig,
): NotesWindowModel {
  return {
    title: source.title,
    description: source.description,
    sourceTabId: source.sourceTabId,
    worldId: source.worldId,
    characterId: source.characterId,
    notes: source.notes,
    spellcheckEnabled: spellcheck.enabled,
    spellcheckLanguage: spellcheck.language,
    spellcheckIgnoredWords: spellcheck.ignoredWords,
    spellcheckSuggestionLimit: spellcheck.suggestionLimit,
    spellcheckMinimumWordLength: spellcheck.minimumWordLength,
    spellcheckDebounceMs: spellcheck.debounceMs,
  };
}

export function createNotesWindowPlaceholderModel(title: string): NotesWindowModel {
  return {
    title,
    description: 'waiting for surface data',
    sourceTabId: '',
    worldId: '',
    characterId: null,
    notes: '',
    spellcheckEnabled: true,
    spellcheckLanguage: 'en-US',
    spellcheckIgnoredWords: '',
    spellcheckSuggestionLimit: 5,
    spellcheckMinimumWordLength: 3,
    spellcheckDebounceMs: 250,
  };
}
