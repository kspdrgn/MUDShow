export interface NotesStoragePort {
  loadNotes(characterId: string, waitForWrites?: boolean): Promise<string>;
  saveNotes(characterId: string, notes: string): Promise<void>;
}

export interface NotesWorkingStateService {
  load(tabId: string, characterId: string, waitForWrites?: boolean): Promise<string>;
  get(tabId: string): string;
  set(tabId: string, notes: string): void;
  scheduleSave(tabId: string, characterId: string, notes: string): void;
  flushSave(tabId: string): Promise<void>;
  cancelSave(tabId: string): void;
  clear(tabId: string): void;
  clearAll(): void;
}

interface PendingSave {
  characterId: string;
  notes: string;
  timer: ReturnType<typeof setTimeout>;
}

export interface NotesWorkingStateServiceOptions {
  storage: NotesStoragePort;
  debounceMs?: number;
}

export function createNotesWorkingStateService({
  storage,
  debounceMs = 300,
}: NotesWorkingStateServiceOptions): NotesWorkingStateService {
  const notesByTab = new Map<string, string>();
  const pendingSaves = new Map<string, PendingSave>();
  const delay = Math.max(0, Math.round(debounceMs));

  function cancelSave(tabId: string): void {
    const pending = pendingSaves.get(tabId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    pendingSaves.delete(tabId);
  }

  async function persist(tabId: string, pending: PendingSave): Promise<void> {
    console.info('[notes] persisting debounced save', {
      tabId,
      characterId: pending.characterId,
      noteLength: pending.notes.length,
    });
    await storage.saveNotes(pending.characterId, pending.notes);
  }

  function scheduleSave(tabId: string, characterId: string, notes: string): void {
    cancelSave(tabId);
    notesByTab.set(tabId, notes);

    const timer = setTimeout(() => {
      const pending = pendingSaves.get(tabId);
      if (!pending) {
        return;
      }

      pendingSaves.delete(tabId);
      void persist(tabId, pending);
    }, delay);

    pendingSaves.set(tabId, { characterId, notes, timer });
  }

  async function flushSave(tabId: string): Promise<void> {
    const pending = pendingSaves.get(tabId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timer);
    pendingSaves.delete(tabId);
    await persist(tabId, pending);
  }

  return {
    async load(tabId, characterId, waitForWrites = true): Promise<string> {
      const notes = await storage.loadNotes(characterId, waitForWrites);
      notesByTab.set(tabId, notes);
      return notes;
    },
    get(tabId): string {
      return notesByTab.get(tabId) ?? '';
    },
    set(tabId, notes): void {
      notesByTab.set(tabId, notes);
    },
    scheduleSave,
    flushSave,
    cancelSave,
    clear(tabId): void {
      cancelSave(tabId);
      notesByTab.delete(tabId);
    },
    clearAll(): void {
      for (const tabId of pendingSaves.keys()) {
        cancelSave(tabId);
      }
      notesByTab.clear();
    },
  };
}
