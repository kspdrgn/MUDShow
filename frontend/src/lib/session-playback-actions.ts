import type { Writable } from 'svelte/store';
import type { MudConnection } from './connection';
import {
  appendTranscriptHistory,
  playBeep,
} from './playback';
import {
  loadNotes,
  loadTranscriptHistory,
  saveHighlights,
  saveNotes as persistNotes,
  saveTranscriptHistory,
} from './storage';
import { buildHighlightRegexes } from './formatting';
import {
  createInputBar,
  getNextInputBarId,
  normalizeInputBars,
  type InputBarId,
} from './input-bars';
import { DEFAULT_OUTPUT_HISTORY_LINES, type SessionState } from './session-state';
import { nextFrame, focusElement, scrollElementToBottom } from './session-dom';
import type { CharacterRecord, WorldRecord } from './types';
import type { WorldTabSessionState } from './world-session';
import {
  getWorldDomScope,
  getWorldHighlightInputId,
  getWorldInputBarInputId,
  getWorldNotesEditorId,
  getWorldOutputAreaId,
} from './world-dom';

interface PlaybackActionContext {
  state: Writable<SessionState>;
  getState: () => SessionState;
  patch: (patch: Partial<SessionState>) => void;
  getActiveWorldTabId: () => string | null;
  getWorldSession: (tabId: string) => WorldTabSessionState;
  ensureWorldSession: (tabId: string) => WorldTabSessionState;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
  setWorldOutput: (tabId: string, outputChunks: string[], outputEndsWithBr: boolean) => void;
  activateWorldTab: (tabId: string) => void;
  getWorldConnection: (tabId: string) => MudConnection | null;
  closeWorldTabConnection: (tabId: string) => Promise<void>;
  closeTab: (tabId: string, source?: 'mouse' | 'shortcut') => void;
  getHighlightRegexes: () => ReturnType<typeof buildHighlightRegexes>;
  setHighlightRegexes: (regexes: ReturnType<typeof buildHighlightRegexes>) => void;
  ensureWorldTab: (world: WorldRecord, character: CharacterRecord) => string;
}

export function createPlaybackActions({
  getState,
  patch,
  getActiveWorldTabId,
  getWorldSession,
  ensureWorldSession,
  updateWorldSession,
  setWorldOutput,
  activateWorldTab,
  getWorldConnection,
  closeWorldTabConnection,
  closeTab,
  getHighlightRegexes,
  setHighlightRegexes,
  ensureWorldTab,
}: PlaybackActionContext) {
  function getActiveWorldSession(): WorldTabSessionState | null {
    const tabId = getActiveWorldTabId();
    return tabId ? getWorldSession(tabId) : null;
  }

  function getActiveWorldScope(): string | null {
    const tabId = getActiveWorldTabId();
    return tabId ? getWorldDomScope(tabId) : null;
  }

  async function appendOutputToTab(tabId: string, rawText: string): Promise<void> {
    const session = getWorldSession(tabId);
    const next = session.transcript.append(rawText);
    const maxHistoryLines = session.currentCharacter?.outputHistoryLines ?? DEFAULT_OUTPUT_HISTORY_LINES;

    if (session.currentCharacter && maxHistoryLines > 0) {
      const transcriptHistory = appendTranscriptHistory(session.transcriptHistory, rawText, maxHistoryLines);
      updateWorldSession(tabId, { transcriptHistory });
      void saveTranscriptHistory(session.currentCharacter.id, transcriptHistory, maxHistoryLines);
    }

    setWorldOutput(tabId, next.chunks, next.endsWithBr);

    await nextFrame();
    if (getActiveWorldTabId() === tabId && !session.userScrolled) {
      scrollElementToBottom(getWorldOutputAreaId(getWorldDomScope(tabId)));
    }
  }

  function handleVisibilityChange(): void {
    if (!document.hidden) {
      const tabId = getActiveWorldTabId();
      if (!tabId) {
        return;
      }

      const session = getWorldSession(tabId);
      updateWorldSession(tabId, { hasNewActivity: false });

      const scope = getActiveWorldScope();
      if (scope && !session.userScrolled) {
        scrollElementToBottom(getWorldOutputAreaId(scope));
      }
    }
  }

  function handleGlobalKeyDown(event: KeyboardEvent): void {
    const state = getState();

    if (state.closeConfirmTabId !== null) {
      if (event.key === 'Escape') {
        event.preventDefault();
        patch({ closeConfirmTabId: null });
      }
      return;
    }

    if (state.modalOpen) {
      if (event.key === 'Escape') {
        event.preventDefault();
        patch({ modalOpen: false });
      }
      return;
    }

    if (event.ctrlKey && event.key === 'F4') {
      event.preventDefault();

      const activeTabId = state.activeTabId;
      if (activeTabId !== null) {
        patch({ modalOpen: false, modalKind: null });
        closeTab(activeTabId, 'shortcut');
      }

      return;
    }

    if (getActiveWorldTabId() === null) {
      return;
    }

    const session = getActiveWorldSession();
    if (!session) {
      return;
    }

    const hotkeyBar = session.inputBars.find((bar) => bar.label === event.key);

    if (hotkeyBar) {
      event.preventDefault();
      updateWorldSession(getActiveWorldTabId()!, { activeBar: hotkeyBar.id });
      const scope = getActiveWorldScope();
      if (scope) {
        focusElement(getWorldInputBarInputId(scope, hotkeyBar.id));
      }
    } else if (event.key === 'F3') {
      event.preventDefault();
      void togglePanel('notes');
    } else if (event.key === 'F4') {
      event.preventDefault();
      void togglePanel('highlights');
    }
  }

  async function connectToCharacter(index: number): Promise<void> {
    const state = getState();
    const character = state.characters[index];
    if (!character) {
      return;
    }

    const world = state.worlds.find((entry) => entry.id === character.worldId);
    if (!world) {
      return;
    }

    const tabId = ensureWorldTab(world, character);
    const session = ensureWorldSession(tabId);
    const connection = getWorldConnection(tabId);

    if (!connection) {
      return;
    }

    const activeBar = session.activeBar ?? session.inputBars[0]?.id ?? 1;
    const shouldInitializeSession = session.currentCharacter === null;

    if (shouldInitializeSession) {
      const maxHistoryLines = character.outputHistoryLines ?? DEFAULT_OUTPUT_HISTORY_LINES;
      const highlightRegexes = buildHighlightRegexes(state.highlights);
      const [notes, history] = await Promise.all([
        loadNotes(character.id, false),
        loadTranscriptHistory(character.id, maxHistoryLines, false),
      ]);

      const historySnapshot = maxHistoryLines > 0
        ? session.transcript.loadHistory(history)
        : session.transcript.loadHistory([]);

      setHighlightRegexes(highlightRegexes);

      updateWorldSession(tabId, {
        currentWorld: world,
        currentCharacter: character,
        notesVisible: false,
        highlightsVisible: false,
        connectionStatus: 'connecting',
        disconnectReason: null,
        hasNewActivity: false,
        outputChunks: historySnapshot.chunks,
        outputEndsWithBr: historySnapshot.endsWithBr,
        outputRevision: session.outputRevision + 1,
        userScrolled: false,
        activeBar,
        notes,
        transcriptHistory: history,
      });
    } else {
      updateWorldSession(tabId, {
        currentWorld: world,
        currentCharacter: character,
        connectionStatus: 'connecting',
        disconnectReason: null,
        hasNewActivity: false,
      });
    }

    activateWorldTab(tabId);
    focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), activeBar));

    await connection.connect(
      {
        host: world.host,
        port: world.port,
        tls: world.tls,
        verifyCertificate: world.verifyCertificate,
      },
      {
        onOpen: () => {
          if (character.connectString && character.connectString.trim()) {
            connection.send(`${character.connectString}\r\n`);
          }
          updateWorldSession(tabId, { connectionStatus: 'connected', disconnectReason: null });
          void appendOutputToTab(tabId, `\x1b[90m[connected to ${world.host}:${world.port}]\x1b[0m\n`);
        },
        onMessage: (text) => {
          void appendOutputToTab(tabId, text);

          const current = getWorldSession(tabId);
          if (document.hidden && !current.hasNewActivity) {
            if (character.sound) {
              playBeep();
            }

            updateWorldSession(tabId, { hasNewActivity: true });
          }
        },
        onClose: () => {
          updateWorldSession(tabId, { connectionStatus: 'disconnected', disconnectReason: 'remote' });
          void appendOutputToTab(tabId, '\x1b[90m[disconnected - reconnect available]\x1b[0m\n');
        },
        onError: (message) => {
          updateWorldSession(tabId, { connectionStatus: 'disconnected', disconnectReason: 'error' });
          void appendOutputToTab(tabId, `\x1b[31m[connection error] ${message}\x1b[0m\n`);
        },
      },
    );
  }

  async function reconnectWorldTab(tabId: string): Promise<void> {
    const state = getState();
    const tab = state.tabs.find((entry) => entry.id === tabId);
    const session = getWorldSession(tabId);

    if (!tab || tab.kind !== 'world' || !session.currentCharacter || !session.currentWorld) {
      return;
    }

    const characterIndex = state.characters.findIndex((character) => character.id === session.currentCharacter?.id);
    if (characterIndex < 0) {
      return;
    }

    await connectToCharacter(characterIndex);
  }

  async function disconnectWorldTab(tabId: string): Promise<void> {
    const tab = getState().tabs.find((entry) => entry.id === tabId);
    const session = getWorldSession(tabId);

    if (!tab || tab.kind !== 'world') {
      return;
    }

    if (session.connectionStatus === 'idle' || session.connectionStatus === 'disconnected') {
      return;
    }

    updateWorldSession(tabId, {
      connectionStatus: 'disconnected',
      disconnectReason: 'manual',
    });

    await closeWorldTabConnection(tabId);
  }

  function handleOutputScroll(): void {
    const scope = getActiveWorldScope();
    if (!scope) {
      return;
    }

    const outputEl = document.getElementById(getWorldOutputAreaId(scope));

    if (!outputEl) {
      return;
    }

    const distance = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    updateWorldSession(tabId, { userScrolled: distance > 50 });
  }

  function handleScrollToBottom(): void {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    updateWorldSession(tabId, { userScrolled: false });
    scrollElementToBottom(getWorldOutputAreaId(getWorldDomScope(tabId)));
  }

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

    getWorldConnection(tabId)?.send(value + '\r\n');

    const session = getWorldSession(tabId);
    if (!session.userScrolled) {
      const scope = getActiveWorldScope();
      if (scope) {
        scrollElementToBottom(getWorldOutputAreaId(scope));
      }
    }
  }

  function completeInput(value: string, selectionStart: number): { value: string; cursor: number } | null {
    const session = getActiveWorldSession();
    return session ? session.transcript.complete(value, selectionStart) : null;
  }

  function resetCompletion(): void {
    const session = getActiveWorldSession();
    session?.transcript.resetCompletion();
  }

  async function togglePanel(panel: 'notes' | 'highlights'): Promise<void> {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const session = getWorldSession(tabId);
    const shouldOpen = panel === 'notes' ? !session.notesVisible : !session.highlightsVisible;

    if (panel === 'notes') {
      updateWorldSession(tabId, {
        notesVisible: shouldOpen,
        highlightsVisible: false,
      });
    } else {
      updateWorldSession(tabId, {
        highlightsVisible: shouldOpen,
        notesVisible: false,
      });
    }

    await nextFrame();

    if (shouldOpen) {
      const scope = getActiveWorldScope();
      if (scope) {
        focusElement(panel === 'notes' ? getWorldNotesEditorId(scope) : getWorldHighlightInputId(scope));
      }
    } else {
      focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), session.activeBar));
    }
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
    focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), nextBar.id));
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
    focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), nextActiveBar));
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

  function addHighlight(pattern: string, color: string): void {
    const trimmed = pattern.trim();

    if (!trimmed) {
      return;
    }

    const state = getState();
    const next = [...state.highlights, { pattern: trimmed, color }];
    void saveHighlights(next);
    setHighlightRegexes(buildHighlightRegexes(next));
    patch({ highlights: next });
  }

  function deleteHighlight(index: number): void {
    const state = getState();
    const next = [...state.highlights];
    next.splice(index, 1);
    void saveHighlights(next);
    setHighlightRegexes(buildHighlightRegexes(next));
    patch({ highlights: next });
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

    void persistNotes(session.currentCharacter.id, notes);
    updateWorldSession(tabId, { notes });
  }

  return {
    handleVisibilityChange,
    handleGlobalKeyDown,
    connectToCharacter,
    reconnectWorldTab,
    disconnectWorldTab,
    handleOutputScroll,
    handleScrollToBottom,
    handleInputFocus,
    handleInputSubmit,
    completeInput,
    resetCompletion,
    togglePanel,
    addInputBarAfter,
    removeInputBar,
    resizeInputBar,
    addHighlight,
    deleteHighlight,
    saveNotes,
  };
}
