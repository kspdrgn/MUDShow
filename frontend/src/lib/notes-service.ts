import { createWorldSessionServiceKey, type WorldSessionServiceKey } from './world-session-services';

export interface NotesStoragePort {
  loadNotes(characterId: string, waitForWrites?: boolean): Promise<string>;
  saveNotes(characterId: string, notes: string): Promise<void>;
}

export interface NotesWorkingStateService {
  load(waitForWrites?: boolean): Promise<string>;
  get(): string;
  set(notes: string): void;
  scheduleSave(notes: string): void;
  flush(): Promise<void>;
  dispose(): void;
}

export const NOTES_SERVICE_KEY: WorldSessionServiceKey<NotesWorkingStateService> =
  createWorldSessionServiceKey<NotesWorkingStateService>('notes');

interface PendingSave {
  notes: string;
  timer: ReturnType<typeof setTimeout>;
}

export interface NotesWorkingStateServiceOptions {
  storage: NotesStoragePort;
  characterId: string | null;
  debounceMs?: number;
}

export function createNotesWorkingStateService({
  storage,
  characterId,
  debounceMs = 300,
}: NotesWorkingStateServiceOptions): NotesWorkingStateService {
  let notes = '';
  let pendingSave: PendingSave | null = null;
  const delay = Math.max(0, Math.round(debounceMs));

  function cancelSave(): void {
    if (!pendingSave) {
      return;
    }

    clearTimeout(pendingSave.timer);
    pendingSave = null;
  }

  async function persist(pending: PendingSave): Promise<void> {
    console.info('[notes] persisting notes', {
      characterId,
      noteLength: pending.notes.length,
    });
    if (characterId) {
      await storage.saveNotes(characterId, pending.notes);
    }
  }

  function scheduleSave(nextNotes: string): void {
    cancelSave();
    notes = nextNotes;

    const timer = setTimeout(() => {
      const pending = pendingSave;
      pendingSave = null;
      if (!pending) {
        return;
      }

      void persist(pending).catch((error) => {
        console.error('[notes] failed to persist notes', error);
      });
    }, delay);

    pendingSave = { notes: nextNotes, timer };
  }

  async function flush(): Promise<void> {
    if (!pendingSave) {
      return;
    }

    const pending = pendingSave;
    cancelSave();
    await persist(pending);
  }

  return {
    async load(waitForWrites = true): Promise<string> {
      notes = characterId ? await storage.loadNotes(characterId, waitForWrites) : '';
      return notes;
    },
    get(): string {
      return notes;
    },
    set(nextNotes): void {
      notes = nextNotes;
    },
    scheduleSave,
    flush,
    dispose(): void {
      cancelSave();
    },
  };
}
