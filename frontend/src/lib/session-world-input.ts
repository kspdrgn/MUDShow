import { saveNotes as persistNotes } from './storage';
import { createInputBar, getNextInputBarId, normalizeInputBars, type InputBarId } from './input-bars';
import { nextFrame, focusElement, scrollElementToBottom } from './session-dom';
import type { WorldSessionContainerRegistry } from './world-session-container';
import type { WorldTabSessionState } from './world-session';
import { getWorldDomScope, getWorldInputBarInputId, getWorldOutputAreaId } from './world-dom';

interface WorldInputActionContext {
  getActiveWorldTabId: () => string | null;
  resolveActiveWorldScope: () => string | null;
  getWorldSession: (tabId: string) => WorldTabSessionState;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
  worldSessionContainers: WorldSessionContainerRegistry;
  appendDebugConsoleMessageToTab: (tabId: string, direction: 'incoming' | 'outgoing' | 'status', text: string) => void;
  getWorldConnection: (tabId: string) => { send(message: string): void } | null;
}

interface PendingNotesSave {
  characterId: string;
  notes: string;
  timer: ReturnType<typeof setTimeout>;
}

const pendingNotesSaves = new Map<string, PendingNotesSave>();

function clearPendingNotesSave(tabId: string): void {
  const pending = pendingNotesSaves.get(tabId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timer);
  pendingNotesSaves.delete(tabId);
}

function schedulePendingNotesSave(tabId: string, characterId: string, notes: string): void {
  clearPendingNotesSave(tabId);

  const timer = setTimeout(() => {
    const pending = pendingNotesSaves.get(tabId);
    pendingNotesSaves.delete(tabId);

    if (!pending) {
      return;
    }

    console.info('[notes] persisting debounced save', {
      tabId,
      characterId: pending.characterId,
      noteLength: pending.notes.length,
    });
    void persistNotes(pending.characterId, pending.notes);
  }, 300);

  pendingNotesSaves.set(tabId, {
    characterId,
    notes,
    timer,
  });
}

export function flushPendingNotesSave(tabId: string): void {
  const pending = pendingNotesSaves.get(tabId);
  if (!pending) {
    return;
  }

  clearTimeout(pending.timer);
  pendingNotesSaves.delete(tabId);
  console.info('[notes] flushing pending save', {
    tabId,
    characterId: pending.characterId,
    noteLength: pending.notes.length,
  });
  void persistNotes(pending.characterId, pending.notes);
}

export function cancelPendingNotesSave(tabId: string): void {
  clearPendingNotesSave(tabId);
}

export function createWorldInputActions({
  getActiveWorldTabId,
  resolveActiveWorldScope,
  getWorldSession,
  updateWorldSession,
  worldSessionContainers,
  appendDebugConsoleMessageToTab,
  getWorldConnection,
}: WorldInputActionContext) {
  function handleInputFocus(bar: InputBarId): void {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    updateWorldSession(tabId, { activeBar: bar });
  }

  function handleInputSubmit(_bar: InputBarId, value: string): void {
    if (!value.trim()) {
      return;
    }

    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    appendDebugConsoleMessageToTab(tabId, 'outgoing', `${value}\r\n`);
    getWorldConnection(tabId)?.send(value + '\r\n');

    const session = getWorldSession(tabId);
    if (!session.userScrolled) {
      const scope = resolveActiveWorldScope();
      if (scope) {
        scrollElementToBottom(getWorldOutputAreaId(scope));
      }
    }
  }

  function completeInput(value: string, selectionStart: number): { value: string; cursor: number } | null {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return null;
    }

    return getWorldSession(tabId).transcript.complete(value, selectionStart);
  }

  function resetCompletion(): void {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    getWorldSession(tabId).transcript.resetCompletion();
  }

  async function addInputBarAfter(barId: InputBarId): Promise<void> {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const session = getWorldSession(tabId);
    const currentIndex = session.inputBars.findIndex((bar) => bar.id === barId);
    const insertIndex = currentIndex >= 0 ? currentIndex + 1 : session.inputBars.length;
    const nextBar = createInputBar(getNextInputBarId(session.inputBars));

    const nextBars = normalizeInputBars([
      ...session.inputBars.slice(0, insertIndex),
      nextBar,
      ...session.inputBars.slice(insertIndex),
    ]);

    updateWorldSession(tabId, {
      inputBars: nextBars,
      activeBar: nextBar.id,
    });

    await nextFrame();
    focusElement(getWorldInputBarInputId(resolveActiveWorldScope() ?? getWorldDomScope(tabId), nextBar.id));
  }

  async function removeInputBar(barId: InputBarId): Promise<void> {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const session = getWorldSession(tabId);
    if (session.inputBars.length <= 1) {
      return;
    }

    const currentIndex = session.inputBars.findIndex((bar) => bar.id === barId);
    if (currentIndex < 0) {
      return;
    }

    const remainingBars = normalizeInputBars(
      session.inputBars.filter((bar) => bar.id !== barId),
    );

    const nextActiveBar =
      session.activeBar === barId
        ? remainingBars[Math.min(currentIndex, remainingBars.length - 1)]?.id ??
          remainingBars[remainingBars.length - 1]?.id ??
          remainingBars[0]?.id ??
          session.activeBar
        : session.activeBar;

    updateWorldSession(tabId, {
      inputBars: remainingBars,
      activeBar: nextActiveBar,
    });

    await nextFrame();
    focusElement(getWorldInputBarInputId(resolveActiveWorldScope() ?? getWorldDomScope(tabId), nextActiveBar));
  }

  function resizeInputBar(barId: InputBarId, delta: -1 | 1): void {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const session = getWorldSession(tabId);
    const nextBars = session.inputBars.map((bar) => {
      if (bar.id !== barId) {
        return bar;
      }

      return {
        ...bar,
        lines: Math.min(10, Math.max(1, bar.lines + delta)),
      };
    });

    updateWorldSession(tabId, { inputBars: normalizeInputBars(nextBars) });
  }

  function saveNotes(notes: string): void {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const session = getWorldSession(tabId);
    if (!session.currentCharacter) {
      return;
    }

    updateWorldSession(tabId, { notes });
    console.info('[notes] queued save', {
      tabId,
      characterId: session.currentCharacter.id,
      characterName: session.currentCharacter.name,
      noteLength: notes.length,
    });
    schedulePendingNotesSave(tabId, session.currentCharacter.id, notes);
  }

  return {
    handleInputFocus,
    handleInputSubmit,
    completeInput,
    resetCompletion,
    addInputBarAfter,
    removeInputBar,
    resizeInputBar,
    saveNotes,
  };
}
