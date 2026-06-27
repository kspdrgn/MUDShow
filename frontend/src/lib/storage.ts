import type { Character, HighlightRule } from './types';
import { trimTranscriptHistory, type TranscriptHistoryEntry } from './playback';
import { invoke, isTauriAvailable } from './tauri';

const CHARACTER_KEY = 'mudshow_chars';
const HIGHLIGHT_KEY = 'mudshow_highlights';
const HISTORY_KEY = 'mudshow_history';
const NOTES_PREFIX = 'mudshow_notes_';
const STORAGE_MODE_KEY = 'mudshow_storage_mode';
export type DesktopStorageMode = 'webview' | 'file';

interface PersistentData {
  characters: Character[];
  highlights: HighlightRule[];
  history: Record<string, TranscriptHistoryEntry[]>;
  notes: Record<string, string>;
}

let fileWriteQueue: Promise<void> = Promise.resolve();

/** Support local storage both in webview and json file:
 * - 'webview profile' for web deployment. Works in Tauri too, but will write a file in local user profile.
 * - 'file' for external json file storage. Not 'Tauri Store' Better for backup, and user readable.
 */
function getDesktopStorageMode(): DesktopStorageMode {
  // TODO: implement user settings to switch between webview profile, and external json storage.
  if (!isTauriAvailable()) {
    return 'webview';
  }

  return localStorage.getItem(STORAGE_MODE_KEY) === 'file'
    ? 'file'
    : 'webview';
}

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

function createEmptyData(): PersistentData {
  return {
    characters: [],
    highlights: [],
    history: {},
    notes: {},
  };
}

export function setDesktopStorageMode(mode: DesktopStorageMode): void {
  if (typeof window === 'undefined') {
    return;
  }

  localStorage.setItem(STORAGE_MODE_KEY, mode);
}

function readWebviewData(): PersistentData {
  return {
    characters: safeParse(localStorage.getItem(CHARACTER_KEY), []),
    highlights: safeParse(localStorage.getItem(HIGHLIGHT_KEY), []),
    history: safeParse<Record<string, TranscriptHistoryEntry[]>>(localStorage.getItem(HISTORY_KEY), {}) ?? {},
    notes: Object.keys(localStorage)
      .filter((key) => key.startsWith(NOTES_PREFIX))
      .reduce<Record<string, string>>((accumulator, key) => {
        accumulator[key.slice(NOTES_PREFIX.length)] = localStorage.getItem(key) ?? '';
        return accumulator;
      }, {}),
  };
}

function writeWebviewData(data: PersistentData): void {
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
  const parsed = safeParse<Partial<PersistentData>>(raw, {});

  return {
    ...createEmptyData(),
    ...parsed,
    characters: parsed.characters ?? [],
    highlights: parsed.highlights ?? [],
    history: parsed.history ?? {},
    notes: parsed.notes ?? {},
  };
}

async function writeFileData(data: PersistentData): Promise<void> {
  await invoke<void>('save_app_storage', {
    json: JSON.stringify(data),
  });
}

async function waitForPendingFileWrites(): Promise<void> {
  await fileWriteQueue;
}

function queueFileMutation(mutator: (data: PersistentData) => PersistentData): Promise<void> {
  fileWriteQueue = fileWriteQueue.then(async () => {
    const current = await readFileData();
    const next = mutator(current);
    await writeFileData(next);
  }).catch((error) => {
    console.error('failed to persist MUDShow data:', error);
  });

  return fileWriteQueue;
}

function updateNotes(data: PersistentData, characterName: string, notes: string | null): PersistentData {
  const nextNotes = { ...data.notes };

  if (notes === null) {
    delete nextNotes[characterName];
  } else {
    nextNotes[characterName] = notes;
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
  const nextHistory = { ...data.history };

  if (entries === null) {
    delete nextHistory[characterName];
  } else {
    nextHistory[characterName] = entries;
  }

  return {
    ...data,
    history: nextHistory,
  };
}

export async function loadCharacters(): Promise<Character[]> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    return safeParse(localStorage.getItem(CHARACTER_KEY), []);
  }

  await waitForPendingFileWrites();
  const data = await readFileData();
  return data.characters;
}

export async function saveCharacters(characters: Character[]): Promise<void> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    localStorage.setItem(CHARACTER_KEY, JSON.stringify(characters));
    return;
  }

  await queueFileMutation((data) => ({
    ...data,
    characters,
  }));
}

export async function loadTranscriptHistory(
  characterName: string,
  maxLines = Number.POSITIVE_INFINITY,
): Promise<TranscriptHistoryEntry[]> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    const history = safeParse<Record<string, TranscriptHistoryEntry[]>>(localStorage.getItem(HISTORY_KEY), {}) ?? {};
    return trimTranscriptHistory(history[characterName] ?? [], maxLines);
  }

  await waitForPendingFileWrites();
  const data = await readFileData();
  return trimTranscriptHistory(data.history[characterName] ?? [], maxLines);
}

export async function saveTranscriptHistory(
  characterName: string,
  entries: TranscriptHistoryEntry[],
  maxLines = Number.POSITIVE_INFINITY,
): Promise<void> {
  const nextEntries = trimTranscriptHistory(entries, maxLines);

  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    const history = safeParse<Record<string, TranscriptHistoryEntry[]>>(localStorage.getItem(HISTORY_KEY), {}) ?? {};
    const nextHistory = { ...history };

    if (nextEntries.length > 0) {
      nextHistory[characterName] = nextEntries;
    } else {
      delete nextHistory[characterName];
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    return;
  }

  await queueFileMutation((data) => updateHistory(data, characterName, nextEntries.length > 0 ? nextEntries : null));
}

export async function moveTranscriptHistory(fromCharacterName: string, toCharacterName: string): Promise<void> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    const history = safeParse<Record<string, TranscriptHistoryEntry[]>>(localStorage.getItem(HISTORY_KEY), {}) ?? {};
    const nextHistory = { ...history };
    const entries = nextHistory[fromCharacterName];

    delete nextHistory[fromCharacterName];

    if (entries !== undefined) {
      nextHistory[toCharacterName] = entries;
    } else {
      delete nextHistory[toCharacterName];
    }

    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    return;
  }

  await queueFileMutation((data) => {
    const nextHistory = { ...data.history };
    const entries = nextHistory[fromCharacterName];

    delete nextHistory[fromCharacterName];

    if (entries !== undefined) {
      nextHistory[toCharacterName] = entries;
    } else {
      delete nextHistory[toCharacterName];
    }

    return {
      ...data,
      history: nextHistory,
    };
  });
}

export async function deleteTranscriptHistory(characterName: string): Promise<void> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    const history = safeParse<Record<string, TranscriptHistoryEntry[]>>(localStorage.getItem(HISTORY_KEY), {}) ?? {};
    const nextHistory = { ...history };
    delete nextHistory[characterName];
    localStorage.setItem(HISTORY_KEY, JSON.stringify(nextHistory));
    return;
  }

  await queueFileMutation((data) => updateHistory(data, characterName, null));
}

export async function loadNotes(characterName: string): Promise<string> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    return localStorage.getItem(`${NOTES_PREFIX}${characterName}`) ?? '';
  }

  await waitForPendingFileWrites();
  const data = await readFileData();
  return data.notes[characterName] ?? '';
}

export async function saveNotes(characterName: string, notes: string): Promise<void> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    localStorage.setItem(`${NOTES_PREFIX}${characterName}`, notes);
    return;
  }

  await queueFileMutation((data) => updateNotes(data, characterName, notes));
}

export async function moveNotes(fromCharacterName: string, toCharacterName: string): Promise<void> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    const notes = localStorage.getItem(`${NOTES_PREFIX}${fromCharacterName}`);

    if (notes === null) {
      localStorage.removeItem(`${NOTES_PREFIX}${toCharacterName}`);
      return;
    }

    localStorage.removeItem(`${NOTES_PREFIX}${fromCharacterName}`);
    localStorage.setItem(`${NOTES_PREFIX}${toCharacterName}`, notes);
    return;
  }

  await queueFileMutation((data) => {
    const nextNotes = { ...data.notes };
    const notes = nextNotes[fromCharacterName];

    delete nextNotes[fromCharacterName];

    if (notes !== undefined) {
      nextNotes[toCharacterName] = notes;
    } else {
      delete nextNotes[toCharacterName];
    }

    return {
      ...data,
      notes: nextNotes,
    };
  });
}

export async function deleteNotes(characterName: string): Promise<void> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    localStorage.removeItem(`${NOTES_PREFIX}${characterName}`);
    return;
  }

  await queueFileMutation((data) => updateNotes(data, characterName, null));
}

export async function loadHighlights(): Promise<HighlightRule[]> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    return safeParse(localStorage.getItem(HIGHLIGHT_KEY), []);
  }

  await waitForPendingFileWrites();
  const data = await readFileData();
  return data.highlights;
}

export async function saveHighlights(rules: HighlightRule[]): Promise<void> {
  if (!isTauriAvailable() || getDesktopStorageMode() === 'webview') {
    localStorage.setItem(HIGHLIGHT_KEY, JSON.stringify(rules));
    return;
  }

  await queueFileMutation((data) => ({
    ...data,
    highlights: rules,
  }));
}

export async function loadSessionData(): Promise<{ characters: Character[]; highlights: HighlightRule[] }> {
  const [characters, highlights] = await Promise.all([loadCharacters(), loadHighlights()]);
  return { characters, highlights };
}
