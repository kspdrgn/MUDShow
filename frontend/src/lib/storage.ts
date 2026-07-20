import type { CharacterRecord, HighlightRule, Rule, WorldRecord } from './types';
import {
  normalizeAppStyleOverrides,
  type AppStyleOverrides,
} from './components/style-settings';
import { trimTranscriptHistory, type TranscriptHistoryEntry } from './playback';
import { invoke, isTauriAvailable } from './tauri';

const WORLD_KEY = 'mudshow_worlds';
const CHARACTER_KEY = 'mudshow_chars';
const HIGHLIGHT_KEY = 'mudshow_highlights';
const RULE_KEY = 'mudshow_rules';
const HISTORY_KEY = 'mudshow_history';
const NOTES_PREFIX = 'mudshow_notes_';
const STYLE_KEY = 'mudshow_style';
const STORAGE_SCHEMA_VERSION = 3;

export type DesktopStorageMode = 'file';

interface PersistentData {
  schemaVersion: number;
  worlds: WorldRecord[];
  characters: CharacterRecord[];
  highlights: HighlightRule[];
  rules: Rule[];
  notes: Record<string, string>;
  style: AppStyleOverrides;
}

let fileWriteQueue: Promise<void> = Promise.resolve();
let storageAccessQueue: Promise<void> = Promise.resolve();

function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) {
    return fallback;
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function createId(prefix: string): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `${prefix}-${uuid}` : `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function createEmptyData(): PersistentData {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    worlds: [],
    characters: [],
    highlights: [],
    rules: [],
    notes: {},
    style: {},
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toStringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function toBooleanValue(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function toNumberValue(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function normalizeWorldRecord(value: unknown): WorldRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const host = toStringValue(value.host).trim();
  const port = toNumberValue(value.port, Number.NaN);

  if (!host || !Number.isFinite(port)) {
    return null;
  }

  const tls = toBooleanValue(value.tls, true);
  const verifyCertificate = tls && toBooleanValue(value.verifyCertificate, true);

  return {
    id: toStringValue(value.id).trim() || createId('world'),
    name: toStringValue(value.name).trim() || `${host}:${port}`,
    host,
    port,
    tls,
    verifyCertificate,
  };
}

function normalizeCharacterRecord(value: unknown): CharacterRecord | null {
  if (!isRecord(value)) {
    return null;
  }

  const worldId = toStringValue(value.worldId).trim();
  const name = toStringValue(value.name).trim();
  const isDefault = toBooleanValue(value.isDefault, false);

  if (!worldId || !name) {
    return null;
  }

  return {
    id: toStringValue(value.id).trim() || createId('character'),
    worldId,
    name,
    isDefault,
    width: typeof value.width === 'number' && Number.isFinite(value.width) ? value.width : undefined,
    sound: typeof value.sound === 'boolean' ? value.sound : undefined,
    outputHistoryLines:
      typeof value.outputHistoryLines === 'number' && Number.isFinite(value.outputHistoryLines)
        ? value.outputHistoryLines
        : undefined,
    connectString:
      !isDefault && typeof value.connectString === 'string' && value.connectString.trim()
        ? value.connectString
        : undefined,
  };
}

function normalizeHighlightRule(value: unknown): HighlightRule | null {
  if (!isRecord(value)) {
    return null;
  }

  const pattern = toStringValue(value.pattern).trim();
  if (!pattern) {
    return null;
  }

  return {
    pattern,
    foregroundColor: toStringValue(value.foregroundColor).trim() || '#f1c40f',
    backgroundColor: toStringValue(value.backgroundColor).trim() || '#000000',
    caseSensitive: toBooleanValue(value.caseSensitive, false),
    wordBoundary: toBooleanValue(value.wordBoundary, true),
  };
}

function normalizeRule(value: unknown): Rule | null {
  if (!isRecord(value)) {
    return null;
  }

  const pattern = toStringValue(value.pattern).trim();
  if (!pattern) {
    return null;
  }

  const normalized: Rule = {
    label: toStringValue(value.label).trim(),
    pattern,
    caseSensitive: toBooleanValue(value.caseSensitive, false),
    sampleText: toStringValue(value.sampleText).trim() || 'sample text to test the rule',
    wholeLine: toBooleanValue(value.wholeLine, false),
  };

  if (Object.prototype.hasOwnProperty.call(value, 'foregroundColor')) {
    const foregroundColor = toStringValue(value.foregroundColor).trim();
    if (foregroundColor) {
      normalized.foregroundColor = foregroundColor;
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, 'backgroundColor')) {
    const backgroundColor = toStringValue(value.backgroundColor).trim();
    if (backgroundColor) {
      normalized.backgroundColor = backgroundColor;
    }
  }

  if (Object.prototype.hasOwnProperty.call(value, 'opacity')) {
    const opacity = toNumberValue(value.opacity, Number.NaN);
    if (Number.isFinite(opacity)) {
      normalized.opacity = Math.min(1, Math.max(0, opacity));
    }
  }

  return normalized;
}

function createDefaultCharacter(worldId: string): CharacterRecord {
  return {
    id: createId('character'),
    worldId,
    name: 'Default',
    isDefault: true,
  };
}

function injectDefaultCharacters(data: PersistentData): PersistentData {
  const nextCharacters = [...data.characters];
  const existingDefaults = new Set(nextCharacters.filter((character) => character.isDefault).map((character) => character.worldId));

  for (const world of data.worlds) {
    if (!existingDefaults.has(world.id)) {
      nextCharacters.push(createDefaultCharacter(world.id));
    }
  }

  return {
    ...data,
    characters: nextCharacters,
  };
}

function buildSessionCharacters(worlds: WorldRecord[], characters: CharacterRecord[]): CharacterRecord[] {
  return injectDefaultCharacters({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    worlds,
    characters,
    highlights: [],
    rules: [],
    notes: {},
    style: {},
  }).characters;
}

function dedupeWorlds(worlds: WorldRecord[]): WorldRecord[] {
  const byKey = new Map<string, WorldRecord>();

  for (const world of worlds) {
    const key = [world.host, world.port, world.tls ? '1' : '0', world.verifyCertificate ? '1' : '0'].join('|');
    if (!byKey.has(key)) {
      byKey.set(key, world);
    }
  }

  return [...byKey.values()];
}

function normalizePersistentData(
  raw: Partial<Omit<PersistentData, 'characters' | 'worlds' | 'style'>> & {
    characters?: unknown;
    worlds?: unknown;
    style?: unknown;
  },
): PersistentData {
  const worldRecords = Array.isArray(raw.worlds)
    ? raw.worlds.map((entry) => normalizeWorldRecord(entry)).filter((entry): entry is WorldRecord => entry !== null)
    : [];

  const characterRecords = Array.isArray(raw.characters)
    ? raw.characters.map((entry) => normalizeCharacterRecord(entry)).filter((entry): entry is CharacterRecord => entry !== null)
    : [];

  return {
    schemaVersion: typeof raw.schemaVersion === 'number' ? raw.schemaVersion : STORAGE_SCHEMA_VERSION,
    worlds: dedupeWorlds(worldRecords),
    characters: characterRecords,
    highlights: Array.isArray(raw.highlights)
      ? raw.highlights.map((entry) => normalizeHighlightRule(entry)).filter((entry): entry is HighlightRule => entry !== null)
      : [],
    rules: Array.isArray(raw.rules)
      ? raw.rules.map((entry) => normalizeRule(entry)).filter((entry): entry is Rule => entry !== null)
      : [],
    notes: isRecord(raw.notes) ? (raw.notes as Record<string, string>) : {},
    style: normalizeAppStyleOverrides(raw.style),
  };
}

function readWebviewHistory(): Record<string, TranscriptHistoryEntry[]> {
  return safeParse<Record<string, TranscriptHistoryEntry[]>>(localStorage.getItem(HISTORY_KEY), {}) ?? {};
}

function writeWebviewHistory(history: Record<string, TranscriptHistoryEntry[]>): void {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

function readWebviewData(): PersistentData {
  const worlds = safeParse<unknown>(localStorage.getItem(WORLD_KEY), []);
  const characters = safeParse<unknown>(localStorage.getItem(CHARACTER_KEY), []);
  const highlights = safeParse<HighlightRule[]>(localStorage.getItem(HIGHLIGHT_KEY), []);
  const rules = safeParse<Rule[]>(localStorage.getItem(RULE_KEY), []);
  const style = safeParse<unknown>(localStorage.getItem(STYLE_KEY), {});
  const notes = Object.keys(localStorage)
    .filter((key) => key.startsWith(NOTES_PREFIX))
    .reduce<Record<string, string>>((accumulator, key) => {
      accumulator[key.slice(NOTES_PREFIX.length)] = localStorage.getItem(key) ?? '';
      return accumulator;
    }, {});

  return normalizePersistentData({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    worlds,
    characters,
    highlights,
    rules,
    notes,
    style,
  });
}

function writeWebviewData(data: PersistentData): void {
  localStorage.setItem(WORLD_KEY, JSON.stringify(data.worlds));
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(data.characters));
  localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(data.highlights));
  localStorage.setItem(RULE_KEY, JSON.stringify(data.rules));
  localStorage.setItem(STYLE_KEY, JSON.stringify(data.style));

  Object.keys(localStorage)
    .filter((key) => key.startsWith(NOTES_PREFIX))
    .forEach((key) => localStorage.removeItem(key));

  Object.entries(data.notes).forEach(([characterName, notes]) => {
    localStorage.setItem(`${NOTES_PREFIX}${characterName}`, notes);
  });
}

async function readFileData(): Promise<PersistentData> {
  const raw = await invoke<string>('load_app_storage');
  const parsed = safeParse<Partial<Omit<PersistentData, 'characters' | 'worlds'>> & { characters?: unknown; worlds?: unknown }>(raw, {});
  return normalizePersistentData(parsed);
}

export async function getAppStoragePath(): Promise<string> {
  return invoke<string>('get_app_storage_path');
}

export async function getDefaultLogFolder(): Promise<string> {
  return invoke<string>('get_default_log_folder');
}

export async function setAppStoragePath(path: string | null): Promise<string> {
  return invoke<string>('set_app_storage_path', {
    path,
  });
}

export async function revealAppStorageFile(): Promise<void> {
  await invoke<void>('reveal_app_storage_file');
}

export async function pickAppStorageFile(): Promise<string | null> {
  return invoke<string | null>('pick_app_storage_file');
}

export async function moveAppStorageFile(): Promise<string | null> {
  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    return invoke<string | null>('move_app_storage_file');
  });
}

export async function moveDefaultLogFolder(currentFolder: string | null): Promise<string | null> {
  return invoke<string | null>('move_default_log_folder', {
    currentFolder,
  });
}

export async function revealDefaultLogFolder(currentFolder: string | null): Promise<void> {
  await invoke<void>('reveal_default_log_folder', {
    currentFolder,
  });
}

export async function resolveDefaultLogFolder(currentFolder: string | null): Promise<string> {
  return invoke<string>('resolve_default_log_folder', {
    currentFolder,
  });
}

async function writeFileData(data: PersistentData): Promise<void> {
  await invoke<void>('save_app_storage', {
    json: JSON.stringify(data),
  });
}

async function waitForPendingFileWrites(): Promise<void> {
  await fileWriteQueue;
}

async function withStorageAccess<T>(work: () => Promise<T>): Promise<T> {
  const previousAccess = storageAccessQueue;
  let releaseAccess!: () => void;

  storageAccessQueue = new Promise<void>((resolve) => {
    releaseAccess = resolve;
  });

  await previousAccess;

  try {
    return await work();
  } finally {
    releaseAccess();
  }
}

async function readPersistentData(waitForWrites: boolean): Promise<PersistentData> {
  return withStorageAccess(async () => {
    if (waitForWrites) {
      await waitForPendingFileWrites();
    }

    return readFileData();
  });
}

function queueFileMutation(mutator: (data: PersistentData) => PersistentData): Promise<void> {
  const pendingWrites = fileWriteQueue;
  fileWriteQueue = withStorageAccess(async () => {
    await pendingWrites;
    const current = await readFileData();
    const next = mutator(current);
    await writeFileData(next);
  }).catch((error) => {
    console.error('failed to persist MUDShow data:', error);
  });

  return fileWriteQueue;
}

function resolveCharacterNoteKey(characterName: string): string {
  return characterName.trim();
}

function updateNotes(data: PersistentData, characterName: string, notes: string | null): PersistentData {
  const key = resolveCharacterNoteKey(characterName);
  const nextNotes = { ...data.notes };

  if (notes === null) {
    delete nextNotes[key];
  } else {
    nextNotes[key] = notes;
  }

  return {
    ...data,
    notes: nextNotes,
  };
}

export function setDesktopStorageMode(mode: DesktopStorageMode): void {
  void mode;
}

export async function loadWorlds(): Promise<WorldRecord[]> {
  if (!isTauriAvailable()) {
    return readWebviewData().worlds;
  }

  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    const data = await readFileData();
    return data.worlds;
  });
}

export async function saveWorlds(worlds: WorldRecord[]): Promise<void> {
  const normalizedWorlds = dedupeWorlds(
    worlds
      .map((entry) => normalizeWorldRecord(entry))
      .filter((entry): entry is WorldRecord => entry !== null),
  );

  const update = (data: PersistentData): PersistentData => {
    const worldIds = new Set(normalizedWorlds.map((world) => world.id));
    const nextCharacters = injectDefaultCharacters({
      ...data,
      worlds: normalizedWorlds,
      characters: data.characters.filter((character) => worldIds.has(character.worldId)),
    }).characters;

    return {
      ...data,
      worlds: normalizedWorlds,
      characters: nextCharacters,
    };
  };

  if (!isTauriAvailable()) {
    writeWebviewData(update(readWebviewData()));
    return;
  }

  await queueFileMutation(update);
}

export async function loadCharacters(): Promise<CharacterRecord[]> {
  if (!isTauriAvailable()) {
    const data = readWebviewData();
    return buildSessionCharacters(data.worlds, data.characters);
  }

  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    const data = await readFileData();
    return buildSessionCharacters(data.worlds, data.characters);
  });
}

export async function saveCharacters(characters: CharacterRecord[]): Promise<void> {
  const normalizedCharacters = characters
    .map((entry) => normalizeCharacterRecord(entry))
    .filter((entry): entry is CharacterRecord => entry !== null);

  if (!isTauriAvailable()) {
    const current = readWebviewData();
    writeWebviewData({
      ...current,
      characters: normalizedCharacters,
    });
    return;
  }

  await queueFileMutation((data) => ({
    ...data,
    characters: normalizedCharacters,
  }));
}

export async function loadTranscriptHistory(
  characterName: string,
  maxLines = Number.POSITIVE_INFINITY,
  waitForWrites = true,
): Promise<TranscriptHistoryEntry[]> {
  void waitForWrites;
  return trimTranscriptHistory(readWebviewHistory()[resolveCharacterNoteKey(characterName)] ?? [], maxLines);
}

export async function saveTranscriptHistory(
  characterName: string,
  entries: TranscriptHistoryEntry[],
  maxLines = Number.POSITIVE_INFINITY,
): Promise<void> {
  const nextEntries = trimTranscriptHistory(entries, maxLines);
  const nextHistory = readWebviewHistory();
  const key = resolveCharacterNoteKey(characterName);

  if (nextEntries.length > 0) {
    nextHistory[key] = nextEntries;
  } else {
    delete nextHistory[key];
  }

  writeWebviewHistory(nextHistory);
}

export async function moveTranscriptHistory(fromCharacterName: string, toCharacterName: string): Promise<void> {
  const nextHistory = readWebviewHistory();
  const fromKey = resolveCharacterNoteKey(fromCharacterName);
  const toKey = resolveCharacterNoteKey(toCharacterName);
  const entries = nextHistory[fromKey];

  delete nextHistory[fromKey];

  if (entries !== undefined) {
    nextHistory[toKey] = entries;
  } else {
    delete nextHistory[toKey];
  }

  writeWebviewHistory(nextHistory);
}

export async function deleteTranscriptHistory(characterName: string): Promise<void> {
  const nextHistory = readWebviewHistory();
  delete nextHistory[resolveCharacterNoteKey(characterName)];
  writeWebviewHistory(nextHistory);
}

export async function loadNotes(characterName: string, waitForWrites = true): Promise<string> {
  if (!isTauriAvailable()) {
    return readWebviewData().notes[resolveCharacterNoteKey(characterName)] ?? '';
  }

  return readPersistentData(waitForWrites).then((data) => data.notes[resolveCharacterNoteKey(characterName)] ?? '');
}

export async function saveNotes(characterName: string, notes: string): Promise<void> {
  if (!isTauriAvailable()) {
    const current = readWebviewData();
    writeWebviewData(updateNotes(current, characterName, notes));
    return;
  }

  await queueFileMutation((data) => updateNotes(data, characterName, notes));
}

export async function moveNotes(fromCharacterName: string, toCharacterName: string): Promise<void> {
  if (!isTauriAvailable()) {
    const current = readWebviewData();
    const notes = current.notes[resolveCharacterNoteKey(fromCharacterName)];
    const nextNotes = { ...current.notes };

    if (notes === null || notes === undefined) {
      delete nextNotes[resolveCharacterNoteKey(toCharacterName)];
    } else {
      nextNotes[resolveCharacterNoteKey(toCharacterName)] = notes;
    }

    delete nextNotes[resolveCharacterNoteKey(fromCharacterName)];
    writeWebviewData({
      ...current,
      notes: nextNotes,
    });
    return;
  }

  await queueFileMutation((data) => {
    const nextNotes = { ...data.notes };
    const notes = nextNotes[resolveCharacterNoteKey(fromCharacterName)];

    delete nextNotes[resolveCharacterNoteKey(fromCharacterName)];

    if (notes !== undefined) {
      nextNotes[resolveCharacterNoteKey(toCharacterName)] = notes;
    } else {
      delete nextNotes[resolveCharacterNoteKey(toCharacterName)];
    }

    return {
      ...data,
      notes: nextNotes,
    };
  });
}

export async function deleteNotes(characterName: string): Promise<void> {
  if (!isTauriAvailable()) {
    const current = readWebviewData();
    const nextNotes = { ...current.notes };
    delete nextNotes[resolveCharacterNoteKey(characterName)];
    writeWebviewData({
      ...current,
      notes: nextNotes,
    });
    return;
  }

  await queueFileMutation((data) => updateNotes(data, characterName, null));
}

export async function loadHighlights(): Promise<HighlightRule[]> {
  if (!isTauriAvailable()) {
    return readWebviewData().highlights;
  }

  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    const data = await readFileData();
    return data.highlights;
  });
}

export async function saveHighlights(rules: HighlightRule[]): Promise<void> {
  const nextRules = rules.map((rule) => normalizeHighlightRule(rule)).filter((rule): rule is HighlightRule => rule !== null);

  if (!isTauriAvailable()) {
    const current = readWebviewData();
    writeWebviewData({
      ...current,
      highlights: nextRules,
    });
    return;
  }

  await queueFileMutation((data) => ({
    ...data,
    highlights: nextRules,
  }));
}

export async function loadRules(): Promise<Rule[]> {
  if (!isTauriAvailable()) {
    return readWebviewData().rules;
  }

  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    const data = await readFileData();
    return data.rules;
  });
}

export async function saveRules(rules: Rule[]): Promise<void> {
  const nextRules = rules.map((rule) => normalizeRule(rule)).filter((rule): rule is Rule => rule !== null);

  if (!isTauriAvailable()) {
    const current = readWebviewData();
    writeWebviewData({
      ...current,
      rules: nextRules,
    });
    return;
  }

  await queueFileMutation((data) => ({
    ...data,
    rules: nextRules,
  }));
}

export async function loadAppStyleOverrides(): Promise<AppStyleOverrides> {
  if (!isTauriAvailable()) {
    return readWebviewData().style;
  }

  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    const data = await readFileData();
    return data.style;
  });
}

export async function saveAppStyleOverrides(style: AppStyleOverrides): Promise<void> {
  const nextStyle = normalizeAppStyleOverrides(style);

  if (!isTauriAvailable()) {
    const current = readWebviewData();
    writeWebviewData({
      ...current,
      style: nextStyle,
    });
    return;
  }

  await queueFileMutation((data) => ({
    ...data,
    style: nextStyle,
  }));
}

export async function saveConnectionData(worlds: WorldRecord[], characters: CharacterRecord[]): Promise<void> {
  const normalizedWorlds = dedupeWorlds(
    worlds.map((entry) => normalizeWorldRecord(entry)).filter((entry): entry is WorldRecord => entry !== null),
  );
  const normalizedCharacters = buildSessionCharacters(
    normalizedWorlds,
    characters
      .map((entry) => normalizeCharacterRecord(entry))
      .filter((entry): entry is CharacterRecord => entry !== null),
  );
  const nextData: PersistentData = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    worlds: normalizedWorlds,
    characters: normalizedCharacters,
    highlights: [],
    rules: [],
    notes: {},
    style: {},
  };

  if (!isTauriAvailable()) {
    writeWebviewData({
      ...readWebviewData(),
      worlds: nextData.worlds,
      characters: nextData.characters,
    });
    return;
  }

  await queueFileMutation((data) => ({
    ...data,
    worlds: nextData.worlds,
    characters: nextData.characters,
  }));
}

export async function loadSessionData(): Promise<{ worlds: WorldRecord[]; characters: CharacterRecord[]; highlights: HighlightRule[]; rules: Rule[] }> {
  if (!isTauriAvailable()) {
    const data = readWebviewData();
    return {
      worlds: data.worlds,
      characters: buildSessionCharacters(data.worlds, data.characters),
      highlights: data.highlights,
      rules: data.rules,
    };
  }

  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    const data = await readFileData();
    return {
      worlds: data.worlds,
      characters: buildSessionCharacters(data.worlds, data.characters),
      highlights: data.highlights,
      rules: data.rules,
    };
  });
}
