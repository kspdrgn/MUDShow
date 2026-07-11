import type { CharacterRecord, HighlightRule, WorldRecord } from './types';
import { trimTranscriptHistory, type TranscriptHistoryEntry } from './playback';
import { invoke, isTauriAvailable } from './tauri';

const WORLD_KEY = 'mudshow_worlds';
const CHARACTER_KEY = 'mudshow_chars';
const HIGHLIGHT_KEY = 'mudshow_highlights';
const HISTORY_KEY = 'mudshow_history';
const NOTES_PREFIX = 'mudshow_notes_';
const STORAGE_SCHEMA_VERSION = 1;

export type DesktopStorageMode = 'file';

interface PersistentData {
  schemaVersion: number;
  worlds: WorldRecord[];
  characters: CharacterRecord[];
  highlights: HighlightRule[];
  history: Record<string, TranscriptHistoryEntry[]>;
  notes: Record<string, string>;
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
    history: {},
    notes: {},
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

function stripDefaultCharacters(characters: CharacterRecord[]): CharacterRecord[] {
  return characters.filter((character) => !character.isDefault);
}

function buildSessionCharacters(worlds: WorldRecord[], characters: CharacterRecord[]): CharacterRecord[] {
  return injectDefaultCharacters({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    worlds,
    characters,
    highlights: [],
    history: {},
    notes: {},
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
  raw: Partial<Omit<PersistentData, 'characters' | 'worlds'>> & { characters?: unknown; worlds?: unknown },
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
    highlights: Array.isArray(raw.highlights) ? raw.highlights : [],
    history: isRecord(raw.history) ? (raw.history as Record<string, TranscriptHistoryEntry[]>) : {},
    notes: isRecord(raw.notes) ? (raw.notes as Record<string, string>) : {},
  };
}

function readWebviewData(): PersistentData {
  const worlds = safeParse<unknown>(localStorage.getItem(WORLD_KEY), []);
  const characters = safeParse<unknown>(localStorage.getItem(CHARACTER_KEY), []);
  const highlights = safeParse<HighlightRule[]>(localStorage.getItem(HIGHLIGHT_KEY), []);
  const history = safeParse<Record<string, TranscriptHistoryEntry[]>>(localStorage.getItem(HISTORY_KEY), {}) ?? {};
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
    history,
    notes,
  });
}

function writeWebviewData(data: PersistentData): void {
  localStorage.setItem(WORLD_KEY, JSON.stringify(data.worlds));
  localStorage.setItem(CHARACTER_KEY, JSON.stringify(data.characters));
  localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(data.highlights));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));

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

export async function setAppStoragePath(path: string | null): Promise<string> {
  return invoke<string>('set_app_storage_path', {
    path,
  });
}

export async function revealAppStorageFile(): Promise<void> {
  await invoke<void>('reveal_app_storage_file');
}

export async function moveAppStorageFile(): Promise<string | null> {
  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    return invoke<string | null>('move_app_storage_file');
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

function updateHistory(
  data: PersistentData,
  characterName: string,
  entries: TranscriptHistoryEntry[] | null,
): PersistentData {
  const key = resolveCharacterNoteKey(characterName);
  const nextHistory = { ...data.history };

  if (entries === null) {
    delete nextHistory[key];
  } else {
    nextHistory[key] = entries;
  }

  return {
    ...data,
    history: nextHistory,
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
    const nextCharacters = data.characters.filter((character) => worldIds.has(character.worldId));

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
    return stripDefaultCharacters(readWebviewData().characters);
  }

  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    const data = await readFileData();
    return stripDefaultCharacters(data.characters);
  });
}

export async function saveCharacters(characters: CharacterRecord[]): Promise<void> {
  const normalizedCharacters = stripDefaultCharacters(
    characters
    .map((entry) => normalizeCharacterRecord(entry))
    .filter((entry): entry is CharacterRecord => entry !== null),
  );

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
  if (!isTauriAvailable()) {
    const history = readWebviewData().history;
    return trimTranscriptHistory(history[resolveCharacterNoteKey(characterName)] ?? [], maxLines);
  }

  return readPersistentData(waitForWrites).then((data) =>
    trimTranscriptHistory(data.history[resolveCharacterNoteKey(characterName)] ?? [], maxLines),
  );
}

export async function saveTranscriptHistory(
  characterName: string,
  entries: TranscriptHistoryEntry[],
  maxLines = Number.POSITIVE_INFINITY,
): Promise<void> {
  const nextEntries = trimTranscriptHistory(entries, maxLines);

  if (!isTauriAvailable()) {
    const current = readWebviewData();
    writeWebviewData(updateHistory(current, characterName, nextEntries.length > 0 ? nextEntries : null));
    return;
  }

  await queueFileMutation((data) => updateHistory(data, characterName, nextEntries.length > 0 ? nextEntries : null));
}

export async function moveTranscriptHistory(fromCharacterName: string, toCharacterName: string): Promise<void> {
  if (!isTauriAvailable()) {
    const current = readWebviewData();
    const nextHistory = { ...current.history };
    const entries = nextHistory[resolveCharacterNoteKey(fromCharacterName)];

    delete nextHistory[resolveCharacterNoteKey(fromCharacterName)];

    if (entries !== undefined) {
      nextHistory[resolveCharacterNoteKey(toCharacterName)] = entries;
    } else {
      delete nextHistory[resolveCharacterNoteKey(toCharacterName)];
    }

    writeWebviewData({
      ...current,
      history: nextHistory,
    });
    return;
  }

  await queueFileMutation((data) => {
    const nextHistory = { ...data.history };
    const entries = nextHistory[resolveCharacterNoteKey(fromCharacterName)];

    delete nextHistory[resolveCharacterNoteKey(fromCharacterName)];

    if (entries !== undefined) {
      nextHistory[resolveCharacterNoteKey(toCharacterName)] = entries;
    } else {
      delete nextHistory[resolveCharacterNoteKey(toCharacterName)];
    }

    return {
      ...data,
      history: nextHistory,
    };
  });
}

export async function deleteTranscriptHistory(characterName: string): Promise<void> {
  if (!isTauriAvailable()) {
    const current = readWebviewData();
    const nextHistory = { ...current.history };
    delete nextHistory[resolveCharacterNoteKey(characterName)];
    writeWebviewData({
      ...current,
      history: nextHistory,
    });
    return;
  }

  await queueFileMutation((data) => updateHistory(data, characterName, null));
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
  if (!isTauriAvailable()) {
    const current = readWebviewData();
    writeWebviewData({
      ...current,
      highlights: rules,
    });
    return;
  }

  await queueFileMutation((data) => ({
    ...data,
    highlights: rules,
  }));
}

export async function saveConnectionData(worlds: WorldRecord[], characters: CharacterRecord[]): Promise<void> {
  const normalizedWorlds = dedupeWorlds(
    worlds.map((entry) => normalizeWorldRecord(entry)).filter((entry): entry is WorldRecord => entry !== null),
  );
  const normalizedCharacters = stripDefaultCharacters(
    characters
    .map((entry) => normalizeCharacterRecord(entry))
    .filter((entry): entry is CharacterRecord => entry !== null),
  );
  const nextData: PersistentData = {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    worlds: normalizedWorlds,
    characters: normalizedCharacters,
    highlights: [],
    history: {},
    notes: {},
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

export async function loadSessionData(): Promise<{ worlds: WorldRecord[]; characters: CharacterRecord[]; highlights: HighlightRule[] }> {
  if (!isTauriAvailable()) {
    const data = readWebviewData();
    return {
      worlds: data.worlds,
      characters: buildSessionCharacters(data.worlds, data.characters),
      highlights: data.highlights,
    };
  }

  return withStorageAccess(async () => {
    await waitForPendingFileWrites();
    const data = await readFileData();
    return {
      worlds: data.worlds,
      characters: buildSessionCharacters(data.worlds, data.characters),
      highlights: data.highlights,
    };
  });
}
