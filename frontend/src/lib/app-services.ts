import {
  DEFAULT_APP_SETTINGS,
  loadAppSettings,
  saveAppSettings,
  type AppSettings,
} from './app-settings';
import { get, readonly, writable, type Readable } from 'svelte/store';
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
import { createSurfaceRegistry, type SurfaceRegistry } from './surfaces/surface-registry';
import {
  listSystemFonts,
  type FontShelfEntry,
  type SystemFontFamily,
  normalizeFontShelf,
} from './fonts';
import {
  createAppStyleEditor,
  createDefaultAppStyleEditor,
  resolveAppStyleEditor,
  serializeAppStyleEditor,
  type AppStyleEditor,
  type AppStyleOverrides,
  type AppStyleValues,
} from './components/styles/style-settings';
import type { TranscriptHistoryEntry } from './playback';
import type { CharacterRecord, Trigger, WorldRecord } from './types';

export interface SpellcheckSettings {
  enabled: boolean;
  language: string;
  ignoredWords: string;
  suggestionLimit: number;
  minimumWordLength: number;
  debounceMs: number;
  queueConcurrency: number;
}

export interface AppSettingsService {
  current: Readable<AppSettings>;
  getSettings(): AppSettings;
  updateSettings(patch: Partial<AppSettings>): AppSettings;
  saveSettings(settings: AppSettings): AppSettings;
  resetSettings(): AppSettings;
}

export type AppLifecycleHook = () => void | Promise<void>;

export interface AppLifecycleService {
  registerHook(phase: string, hook: AppLifecycleHook): () => void;
  runHooks(phase: string): Promise<void>;
}

export interface AppStorageService {
  getAppStoragePath(): Promise<string>;
  getDefaultLogFolder(): Promise<string>;
  getResolvedDefaultLogFolder(): string | null;
  setAppStoragePath(path: string | null): Promise<string>;
  revealAppStorageFile(): Promise<void>;
  pickAppStorageFile(): Promise<string | null>;
  moveAppStorageFile(): Promise<string | null>;
  moveDefaultLogFolder(): Promise<string | null>;
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
  saveConnectionData(worlds: WorldRecord[], characters: CharacterRecord[]): Promise<void>;
  loadSessionData(): Promise<{ worlds: WorldRecord[]; characters: CharacterRecord[]; triggers: Trigger[] }>;
}

export interface AppStyleService {
  editor: Readable<AppStyleEditor>;
  resolved: Readable<AppStyleValues>;
  fontShelf: Readable<FontShelfEntry[]>;
  saveStyle(nextStyle: AppStyleEditor): void;
  updateFontShelf(nextShelf: FontShelfEntry[]): void;
  listSystemFonts(): Promise<import('./fonts').SystemFontFamily[]>;
}

export interface AppSpellcheckService {
  config: Readable<SpellcheckSettings>;
  getConfig(): SpellcheckSettings;
  normalizeIgnoredWords(raw: string): string;
  appendIgnoredWord(raw: string, word: string): string;
  ignoreWord(word: string): Promise<void>;
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

export type AppNoticeKind = 'custom' | 'confirm' | 'alert';

export interface AppNoticeRecord {
  id: string;
  kind: AppNoticeKind;
  surfaceId: string;
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

export interface AppNoticeService {
  current: Readable<AppNoticeRecord | null>;
  getCurrent(): AppNoticeRecord | null;
  openNotice(notice: Omit<AppNoticeRecord, 'id'>): AppNoticeRecord;
  closeNotice(): void;
  confirm(notice: Omit<AppNoticeRecord, 'id' | 'kind'>): Promise<boolean>;
  alert(notice: Omit<AppNoticeRecord, 'id' | 'kind'>): Promise<void>;
  acceptCurrentNotice(): void;
  dismissCurrentNotice(): void;
}

export interface AppServices {
  lifecycle: AppLifecycleService;
  storage: AppStorageService;
  settings: AppSettingsService;
  style: AppStyleService;
  spellcheck: AppSpellcheckService;
  notice: AppNoticeService;
  windowAttention: WindowAttentionService;
  surfaces: SurfaceRegistry;
}

function createAppLifecycleService(): AppLifecycleService {
  const hooks = new Map<string, AppLifecycleHook[]>();

  function registerHook(phase: string, hook: AppLifecycleHook): () => void {
    const phaseHooks = hooks.get(phase) ?? [];
    phaseHooks.push(hook);
    hooks.set(phase, phaseHooks);

    return () => {
      const nextHooks = hooks.get(phase);
      if (!nextHooks) {
        return;
      }

      const hookIndex = nextHooks.indexOf(hook);
      if (hookIndex < 0) {
        return;
      }

      nextHooks.splice(hookIndex, 1);
      if (nextHooks.length === 0) {
        hooks.delete(phase);
      }
    };
  }

  async function runHooks(phase: string): Promise<void> {
    const phaseHooks = hooks.get(phase);
    if (!phaseHooks || phaseHooks.length === 0) {
      return;
    }

    for (const hook of [...phaseHooks]) {
      try {
        await hook();
      } catch (error) {
        console.error(`failed to run app lifecycle hook for phase ${phase}:`, error);
      }
    }
  }

  return {
    registerHook,
    runHooks,
  };
}

function createAppStorageService(
  settingsService: AppSettingsService,
  lifecycle: AppLifecycleService,
): AppStorageService {
  let resolvedDefaultLogFolder: string | null = null;

  function getResolvedDefaultLogFolder(): string | null {
    return resolvedDefaultLogFolder;
  }

  async function initializeStoragePath(): Promise<void> {
    try {
      const requestedPath = settingsService.getSettings().storageFilePath;
      const resolvedPath = await setAppStoragePath(requestedPath);

      if (requestedPath !== null && requestedPath !== resolvedPath) {
        settingsService.updateSettings({ storageFilePath: null });
      }
    } catch (error) {
      console.error('failed to initialize app storage path:', error);
    }
  }

  async function initializeResolvedDefaultLogFolder(): Promise<void> {
    try {
      const currentFolder = settingsService.getSettings().defaultLogFolder;
      resolvedDefaultLogFolder = currentFolder ?? (await getDefaultLogFolder());
    } catch (error) {
      console.error('failed to initialize resolved default log folder:', error);
      resolvedDefaultLogFolder = settingsService.getSettings().defaultLogFolder ?? null;
    }
  }

  lifecycle.registerHook('startup', initializeStoragePath);
  lifecycle.registerHook('startup', initializeResolvedDefaultLogFolder);

  return {
    getAppStoragePath,
    getDefaultLogFolder,
    getResolvedDefaultLogFolder,
    setAppStoragePath,
    revealAppStorageFile,
    pickAppStorageFile,
    moveAppStorageFile,
    async moveDefaultLogFolder() {
      const currentFolder =
        resolvedDefaultLogFolder ?? settingsService.getSettings().defaultLogFolder ?? (await getDefaultLogFolder());
      const nextFolder = await moveDefaultLogFolder(currentFolder);
      if (nextFolder) {
        resolvedDefaultLogFolder = nextFolder;
        settingsService.saveSettings({
          ...settingsService.getSettings(),
          defaultLogFolder: nextFolder,
        });
      }
      return nextFolder;
    },
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
    saveConnectionData,
    loadSessionData,
  };
}

function createAppStyleService(
  lifecycle: AppLifecycleService,
): AppStyleService {
  const editorStore = writable<AppStyleEditor>(createDefaultAppStyleEditor());
  const resolvedStore = writable<AppStyleValues>(resolveAppStyleEditor(createDefaultAppStyleEditor()));
  const fontShelfStore = writable<FontShelfEntry[]>([]);

  function applyEditor(nextEditor: AppStyleEditor): void {
    editorStore.set(nextEditor);
    resolvedStore.set(resolveAppStyleEditor(nextEditor));
  }

  async function initializeStyleSettings(): Promise<void> {
    try {
      const [overrides, nextFontShelf] = await Promise.all([
        loadAppStyleOverrides(),
        loadFontShelf(),
      ]);

      applyEditor(createAppStyleEditor(overrides));
      fontShelfStore.set(nextFontShelf);
    } catch (error) {
      console.error('failed to load app style overrides:', error);
      applyEditor(createDefaultAppStyleEditor());
      fontShelfStore.set([]);
    }
  }

  lifecycle.registerHook('startup', initializeStyleSettings);

  function saveStyle(nextStyle: AppStyleEditor): void {
    applyEditor(nextStyle);
    void saveAppStyleOverrides(serializeAppStyleEditor(nextStyle));
  }

  function updateFontShelf(nextShelf: FontShelfEntry[]): void {
    fontShelfStore.set(normalizeFontShelf(nextShelf));
    void saveFontShelf(get(fontShelfStore));
  }

  function listSystemFontsForStyle(): Promise<import('./fonts').SystemFontFamily[]> {
    return listSystemFonts();
  }

  return {
    editor: readonly(editorStore),
    resolved: readonly(resolvedStore),
    fontShelf: readonly(fontShelfStore),
    saveStyle,
    updateFontShelf,
    listSystemFonts: listSystemFontsForStyle,
  };
}

function getSpellcheckSettings(settings: AppSettings): SpellcheckSettings {
  return {
    enabled: settings.spellcheckEnabled !== false,
    language: settings.spellcheckLanguage.trim() || DEFAULT_APP_SETTINGS.spellcheckLanguage,
    ignoredWords: normalizeSpellcheckIgnoredWords(settings.spellcheckIgnoredWords),
    suggestionLimit: Math.max(1, Math.round(settings.spellcheckSuggestionLimit)),
    minimumWordLength: Math.max(1, Math.round(settings.spellcheckMinimumWordLength)),
    debounceMs: Math.max(0, Math.round(settings.spellcheckDebounceMs)),
    queueConcurrency: Math.max(1, Math.round(settings.spellcheckQueueConcurrency)),
  };
}

function createAppSettingsService(
  onChange?: (settings: AppSettings) => void,
  initialSettings: AppSettings = loadAppSettings(),
): AppSettingsService {
  let currentSettings = initialSettings;
  const currentStore = writable(currentSettings);

  function getSettings(): AppSettings {
    return currentSettings;
  }

  function saveSettings(settings: AppSettings): AppSettings {
    currentSettings = saveAppSettings(settings);
    currentStore.set(currentSettings);
    onChange?.(currentSettings);
    return currentSettings;
  }

  function updateSettings(patch: Partial<AppSettings>): AppSettings {
    currentSettings = saveAppSettings({
      ...currentSettings,
      ...patch,
    });
    currentStore.set(currentSettings);
    onChange?.(currentSettings);
    return currentSettings;
  }

  function resetSettings(): AppSettings {
    currentSettings = saveAppSettings({ ...DEFAULT_APP_SETTINGS });
    currentStore.set(currentSettings);
    onChange?.(currentSettings);
    return currentSettings;
  }

  return {
    current: readonly(currentStore),
    getSettings,
    updateSettings,
    saveSettings,
    resetSettings,
  };
}

function createAppSpellcheckService(
  settingsService: AppSettingsService,
  config: Readable<SpellcheckSettings>,
): AppSpellcheckService {
  const configStore = readonly(config);

  function getConfig(): SpellcheckSettings {
    return get(configStore);
  }

  async function ignoreWord(word: string): Promise<void> {
    const trimmedWord = word.trim();
    if (!trimmedWord) {
      return;
    }

    const currentConfig = getConfig();
    settingsService.updateSettings({
      spellcheckIgnoredWords: appendSpellcheckIgnoredWord(currentConfig.ignoredWords, trimmedWord),
    });

    try {
      await addSpellcheckWord(trimmedWord, currentConfig.language);
    } catch (error) {
      console.error('failed to add spellcheck word:', error);
    }
  }

  return {
    config: configStore,
    getConfig,
    normalizeIgnoredWords: normalizeSpellcheckIgnoredWords,
    appendIgnoredWord: appendSpellcheckIgnoredWord,
    ignoreWord,
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

function createAppNoticeService(): AppNoticeService {
  const currentStore = writable<AppNoticeRecord | null>(null);
  let pendingResolver: ((accepted: boolean) => void) | null = null;

  function clearPendingResolver(accepted: boolean): void {
    const resolver = pendingResolver;
    pendingResolver = null;
    resolver?.(accepted);
  }

  function getCurrent(): AppNoticeRecord | null {
    return get(currentStore);
  }

  function openNotice(notice: Omit<AppNoticeRecord, 'id'>): AppNoticeRecord {
    const current = getCurrent();
    if (current?.kind === 'confirm' || current?.kind === 'alert') {
      clearPendingResolver(false);
    }

    const nextNotice: AppNoticeRecord = {
      id: globalThis.crypto?.randomUUID?.() ?? `notice-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      ...notice,
    };

    currentStore.set(nextNotice);
    return nextNotice;
  }

  function closeNotice(): void {
    const current = getCurrent();
    if (current?.kind === 'confirm' || current?.kind === 'alert') {
      clearPendingResolver(false);
    }

    currentStore.set(null);
  }

  function acceptCurrentNotice(): void {
    const current = getCurrent();
    if (!current) {
      return;
    }

    if (current.kind === 'confirm') {
      clearPendingResolver(true);
    } else if (current.kind === 'alert') {
      clearPendingResolver(true);
    }

    currentStore.set(null);
  }

  function dismissCurrentNotice(): void {
    const current = getCurrent();
    if (!current) {
      return;
    }

    if (current.kind === 'confirm') {
      clearPendingResolver(false);
    } else if (current.kind === 'alert') {
      clearPendingResolver(true);
    }

    currentStore.set(null);
  }

  function confirm(notice: Omit<AppNoticeRecord, 'id' | 'kind'>): Promise<boolean> {
    closeNotice();
    openNotice({
      ...notice,
      kind: 'confirm',
    });

    return new Promise<boolean>((resolve) => {
      pendingResolver = resolve;
    });
  }

  function alert(notice: Omit<AppNoticeRecord, 'id' | 'kind'>): Promise<void> {
    closeNotice();
    openNotice({
      ...notice,
      kind: 'alert',
    });

    return new Promise<void>((resolve) => {
      pendingResolver = () => resolve();
    });
  }

  return {
    current: readonly(currentStore),
    getCurrent,
    openNotice,
    closeNotice,
    confirm,
    alert,
    acceptCurrentNotice,
    dismissCurrentNotice,
  };
}

export function createAppServices(): AppServices {
  const initialSettings = loadAppSettings();
  const lifecycle = createAppLifecycleService();
  const spellcheckConfig = writable(getSpellcheckSettings(initialSettings));
  const settingsService = createAppSettingsService(
    (settings) => {
      spellcheckConfig.set(getSpellcheckSettings(settings));
    },
    initialSettings,
  );
  const spellcheckService = createAppSpellcheckService(settingsService, readonly(spellcheckConfig));
  const noticeService = createAppNoticeService();
  const storageService = createAppStorageService(settingsService, lifecycle);
  const styleService = createAppStyleService(lifecycle);
  const surfaceRegistry = createSurfaceRegistry();

  return {
    lifecycle,
    storage: storageService,
    settings: settingsService,
    style: styleService,
    spellcheck: spellcheckService,
    notice: noticeService,
    windowAttention,
    surfaces: surfaceRegistry,
  };
}

export type { AppSettings };

export const appServices = createAppServices();
