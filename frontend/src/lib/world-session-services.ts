import {
  appendTranscriptHistory,
  type TranscriptHistoryEntry,
} from './playback.js';
import { appServices } from './app-services.js';
import type { WorldSessionKey } from './world-session-registry.js';

export interface WorldSessionStoragePort {
  loadNotes(characterId: string, waitForWrites?: boolean): Promise<string>;
  saveNotes(characterId: string, notes: string): Promise<void>;
  loadTranscriptHistory(
    characterId: string,
    maxHistoryLines: number,
    waitForWrites?: boolean,
  ): Promise<TranscriptHistoryEntry[]>;
  saveTranscriptHistory(
    characterId: string,
    history: TranscriptHistoryEntry[],
    maxHistoryLines: number,
  ): Promise<void>;
}

export interface WorldSessionNotesService {
  get(): string;
  set(notes: string): void;
  load(waitForWrites?: boolean): Promise<string>;
  scheduleSave(notes: string, delayMs?: number): void;
  flush(): void;
  dispose(): void;
}

export interface WorldSessionTranscriptService {
  getHistory(): TranscriptHistoryEntry[];
  setHistory(history: TranscriptHistoryEntry[]): void;
  loadHistory(maxHistoryLines: number, waitForWrites?: boolean): Promise<TranscriptHistoryEntry[]>;
  appendHistory(rawText: string, maxHistoryLines: number): TranscriptHistoryEntry[];
  saveHistory(maxHistoryLines: number): void;
  dispose(): void;
}

export interface WorldSessionServices {
  notes: WorldSessionNotesService;
  transcript: WorldSessionTranscriptService;
}

function createNotesService(
  characterId: string | null,
  storage: WorldSessionStoragePort,
): WorldSessionNotesService {
  let notes = '';
  let pending: { notes: string; timer: ReturnType<typeof setTimeout> } | null = null;

  function cancelPendingSave(): void {
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    pending = null;
  }

  function save(value: string): void {
    if (!characterId) {
      return;
    }

    void storage.saveNotes(characterId, value).catch((error) => {
      console.error('failed to persist session notes:', error);
    });
  }

  return {
    get(): string {
      return notes;
    },
    set(nextNotes: string): void {
      notes = nextNotes;
    },
    async load(waitForWrites = true): Promise<string> {
      notes = characterId ? await storage.loadNotes(characterId, waitForWrites) : '';
      return notes;
    },
    scheduleSave(nextNotes: string, delayMs = 300): void {
      notes = nextNotes;
      cancelPendingSave();

      if (!characterId) {
        return;
      }

      pending = {
        notes: nextNotes,
        timer: setTimeout(() => {
          const current = pending;
          pending = null;
          if (current) {
            save(current.notes);
          }
        }, delayMs),
      };
    },
    flush(): void {
      if (!pending) {
        return;
      }

      const current = pending;
      cancelPendingSave();
      save(current.notes);
    },
    dispose(): void {
      cancelPendingSave();
    },
  };
}

function createTranscriptService(
  characterId: string | null,
  storage: WorldSessionStoragePort,
): WorldSessionTranscriptService {
  let history: TranscriptHistoryEntry[] = [];

  return {
    getHistory(): TranscriptHistoryEntry[] {
      return [...history];
    },
    setHistory(nextHistory: TranscriptHistoryEntry[]): void {
      history = [...nextHistory];
    },
    async loadHistory(maxHistoryLines: number, waitForWrites = true): Promise<TranscriptHistoryEntry[]> {
      history = characterId
        ? await storage.loadTranscriptHistory(characterId, maxHistoryLines, waitForWrites)
        : [];
      return [...history];
    },
    appendHistory(rawText: string, maxHistoryLines: number): TranscriptHistoryEntry[] {
      history = appendTranscriptHistory(history, rawText, maxHistoryLines);
      return [...history];
    },
    saveHistory(maxHistoryLines: number): void {
      if (!characterId || maxHistoryLines <= 0) {
        return;
      }

      void storage.saveTranscriptHistory(characterId, history, maxHistoryLines).catch((error) => {
        console.error('failed to persist session transcript history:', error);
      });
    },
    dispose(): void {
      history = [];
    },
  };
}

export function createWorldSessionServices(
  key: WorldSessionKey,
  storage: WorldSessionStoragePort = appServices.storage,
): WorldSessionServices {
  return {
    notes: createNotesService(key.characterId, storage),
    transcript: createTranscriptService(key.characterId, storage),
  };
}
