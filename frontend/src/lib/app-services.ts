import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from './app-settings';
import {
  deleteNotes,
  deleteTranscriptHistory,
  getAppStoragePath,
  getDefaultLogFolder,
  loadAppStyleOverrides,
  loadCharacters,
  loadFontShelf,
  loadNotes,
  loadSessionData,
  loadTranscriptHistory,
  loadTriggers,
  loadWorlds,
  moveAppStorageFile,
  moveDefaultLogFolder,
  moveNotes,
  moveTranscriptHistory,
  pickAppStorageFile,
  revealAppStorageFile,
  revealDefaultLogFolder,
  resolveDefaultLogFolder,
  saveAppStyleOverrides,
  saveCharacters,
  saveConnectionData,
  saveFontShelf,
  saveNotes,
  saveTranscriptHistory,
  saveTriggers,
  saveWorlds,
  setAppStoragePath,
  setDesktopStorageMode,
  type DesktopStorageMode,
} from './storage';
import type { FontShelfEntry } from './fonts';
import {
  addSpellcheckWord,
  appendSpellcheckIgnoredWord,
  checkSpellcheckWord,
  escapeSpellcheckHtml,
  getSpellcheckAnnotations,
  getSpellcheckSuggestions,
  getWordBounds,
  normalizeSpellcheckIgnoredWords,
  normalizeSpellcheckWord,
  renderSpellcheckUnderlayHtml,
  splitSpellcheckIgnoredWords,
  suggestSpellcheckWords,
  tokenizeSpellcheckWords,
  type SpellcheckAnnotation,
  type SpellcheckCursorWord,
  type SpellcheckQueryOptions,
} from './spellcheck';
import { windowAttention, type WindowAttentionService } from './window-attention';
import type { AppStyleOverrides } from './components/styles/style-settings';
import type { TranscriptHistoryEntry } from './playback';
import type { CharacterRecord, Trigger, WorldRecord } from './types';

export interface AppSettingsService {
  getSettings(): AppSettings;
  updateSettings(patch: Partial<AppSettings>): AppSettings;
  saveSettings(settings: AppSettings): AppSettings;
  resetSettings(): AppSettings;
}

export interface AppStorageService {
  getAppStoragePath(): Promise<string>;
  getDefaultLogFolder(): Promise<string>;
  setAppStoragePath(path: string | null): Promise<string>;
  revealAppStorageFile(): Promise<void>;
  pickAppStorageFile(): Promise<string | null>;
  moveAppStorageFile(): Promise<string | null>;
  moveDefaultLogFolder(currentFolder: string | null): Promise<string | null>;
  revealDefaultLogFolder(currentFolder: string | null): Promise<void>;
  resolveDefaultLogFolder(currentFolder: string | null): Promise<string>;
  setDesktopStorageMode(mode: DesktopStorageMode): void;
  loadWorlds(): Promise<WorldRecord[]>;
  saveWorlds(worlds: WorldRecord[]): Promise<void>;
  loadCharacters(): Promise<CharacterRecord[]>;
  saveCharacters(characters: CharacterRecord[]): Promise<void>;
  loadTranscriptHistory(characterId: string, maxHistoryLines: number, waitForWrites?: boolean): Promise<TranscriptHistoryEntry[]>;
  saveTranscriptHistory(characterId: string, history: TranscriptHistoryEntry[], maxHistoryLines: number): Promise<void>;
  moveTranscriptHistory(fromCharacterName: string, toCharacterName: string): Promise<void>;
  deleteTranscriptHistory(characterName: string): Promise<void>;
  loadNotes(characterId: string, waitForWrites?: boolean): Promise<string>;
  saveNotes(characterId: string, notes: string): Promise<void>;
  moveNotes(fromCharacterName: string, toCharacterName: string): Promise<void>;
  deleteNotes(characterId: string): Promise<void>;
  loadTriggers(): Promise<Trigger[]>;
  saveTriggers(triggers: Trigger[]): Promise<void>;
  loadAppStyleOverrides(): Promise<AppStyleOverrides>;
  saveAppStyleOverrides(style: AppStyleOverrides): Promise<void>;
  loadFontShelf(): Promise<FontShelfEntry[]>;
  saveFontShelf(fontShelf: FontShelfEntry[]): Promise<void>;
  saveConnectionData(worlds: WorldRecord[], characters: CharacterRecord[]): Promise<void>;
  loadSessionData(): Promise<{ worlds: WorldRecord[]; characters: CharacterRecord[]; triggers: Trigger[] }>;
}

export interface AppSpellcheckService {
  normalizeIgnoredWords(raw: string): string;
  appendIgnoredWord(raw: string, word: string): string;
  splitIgnoredWords(raw: string): string[];
  normalizeWord(word: string): string;
  tokenizeWords(text: string): SpellcheckCursorWord[];
  escapeHtml(text: string): string;
  renderUnderlayHtml(text: string, annotations: SpellcheckAnnotation[]): string;
  checkWord(options: SpellcheckQueryOptions): Promise<boolean>;
  suggestWords(options: SpellcheckQueryOptions): Promise<string[]>;
  getSuggestions(options: SpellcheckQueryOptions): Promise<string[]>;
  getAnnotations(options: SpellcheckQueryOptions & { text: string }): Promise<SpellcheckAnnotation[]>;
  addWord(word: string, language: string): Promise<boolean>;
  getWordBounds(text: string, selectionStart: number, selectionEnd: number): SpellcheckCursorWord | null;
}

export interface AppServices {
  storage: AppStorageService;
  settings: AppSettingsService;
  spellcheck: AppSpellcheckService;
  windowAttention: WindowAttentionService;
}

function createAppStorageService(): AppStorageService {
  return {
    getAppStoragePath,
    getDefaultLogFolder,
    setAppStoragePath,
    revealAppStorageFile,
    pickAppStorageFile,
    moveAppStorageFile,
    moveDefaultLogFolder,
    revealDefaultLogFolder,
    resolveDefaultLogFolder,
    setDesktopStorageMode,
    loadWorlds,
    saveWorlds,
    loadCharacters,
    saveCharacters,
    loadTranscriptHistory,
    saveTranscriptHistory,
    moveTranscriptHistory,
    deleteTranscriptHistory,
    loadNotes,
    saveNotes,
    moveNotes,
    deleteNotes,
    loadTriggers,
    saveTriggers,
    loadAppStyleOverrides,
    saveAppStyleOverrides,
    loadFontShelf,
    saveFontShelf,
    saveConnectionData,
    loadSessionData,
  };
}

function createAppSettingsService(): AppSettingsService {
  let currentSettings = loadAppSettings();

  function getSettings(): AppSettings {
    return currentSettings;
  }

  function saveSettings(settings: AppSettings): AppSettings {
    currentSettings = saveAppSettings(settings);
    return currentSettings;
  }

  function updateSettings(patch: Partial<AppSettings>): AppSettings {
    currentSettings = saveAppSettings({
      ...currentSettings,
      ...patch,
    });
    return currentSettings;
  }

  function resetSettings(): AppSettings {
    currentSettings = saveAppSettings({ ...DEFAULT_APP_SETTINGS });
    return currentSettings;
  }

  return {
    getSettings,
    updateSettings,
    saveSettings,
    resetSettings,
  };
}

function createAppSpellcheckService(): AppSpellcheckService {
  return {
    normalizeIgnoredWords: normalizeSpellcheckIgnoredWords,
    appendIgnoredWord: appendSpellcheckIgnoredWord,
    splitIgnoredWords: splitSpellcheckIgnoredWords,
    normalizeWord: normalizeSpellcheckWord,
    tokenizeWords: tokenizeSpellcheckWords,
    escapeHtml: escapeSpellcheckHtml,
    renderUnderlayHtml: renderSpellcheckUnderlayHtml,
    checkWord: checkSpellcheckWord,
    suggestWords: suggestSpellcheckWords,
    getSuggestions: getSpellcheckSuggestions,
    getAnnotations: getSpellcheckAnnotations,
    addWord: addSpellcheckWord,
    getWordBounds,
  };
}

export function createAppServices(): AppServices {
  return {
    storage: createAppStorageService(),
    settings: createAppSettingsService(),
    spellcheck: createAppSpellcheckService(),
    windowAttention,
  };
}

export type { AppSettings };

export const appServices = createAppServices();
