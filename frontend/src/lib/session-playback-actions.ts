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
import { generateLogFilename, getLogFileName, stripTranscriptForLog } from './logging';
import {
  createInputBar,
  getNextInputBarId,
  normalizeInputBars,
  type InputBarId,
} from './input-bars';
import { DEFAULT_OUTPUT_HISTORY_LINES, type SessionState } from './session-state';
import { isTauriAvailable, invoke } from './tauri';
import {
  focusElement,
  nextFrame,
  scrollElementBy,
  scrollElementToBottom,
  scrollElementToTop,
} from './session-dom';
import type { CharacterRecord, HighlightRule, WorldRecord } from './types';
import type { WorldTabSessionState } from './world-session';
import {
  getWorldDomScope,
  getWorldHighlightInputId,
  getWorldInputBarContainerId,
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

interface CreateSessionLogResult {
  path: string;
  appended: boolean;
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

  function updateOutputScrollState(tabId: string, outputEl: HTMLElement): void {
    const distance = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
    updateWorldSession(tabId, { userScrolled: distance > 50 });
  }

  const logWriteQueues = new Map<string, Promise<void>>();
  let suppressTranscriptScrollState = false;

  function clearLoggingQueue(tabId: string): void {
    logWriteQueues.delete(tabId);
  }

  function enqueueLogWrite(tabId: string, work: () => Promise<void>): Promise<void> {
    const previous = logWriteQueues.get(tabId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);

    logWriteQueues.set(tabId, next.catch(() => undefined));
    return next;
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

    const logText = stripTranscriptForLog(rawText);
    if (isTauriAvailable() && session.loggingActive && session.logFilePath && logText.length > 0) {
      void enqueueLogWrite(tabId, async () => {
        await invoke('append_session_log', {
          path: session.logFilePath,
          text: logText,
        });
      }).catch((error) => {
        console.error('failed to write session log:', error);
      });
    }

    await nextFrame();
    if (getActiveWorldTabId() === tabId && !session.userScrolled) {
      scrollElementToBottom(getWorldOutputAreaId(getWorldDomScope(tabId)));
    }
  }

  async function appendSystemMessageToTab(tabId: string, text: string): Promise<void> {
    await appendOutputToTab(tabId, text);
  }

  async function appendConnectionStatusToTab(tabId: string, rawText: string): Promise<void> {
    await appendOutputToTab(tabId, rawText);
  }

  function buildLogStartMessage(filename: string, appended: boolean): string {
    return `\x1b[90m[logging started] ${filename}${appended ? ' [appending]' : ''}\x1b[0m\n`;
  }

  function buildLogStopMessage(): string {
    return '\x1b[90m[logging stopped]\x1b[0m\n';
  }

  function buildLogRenameMessage(filename: string): string {
    return `\x1b[90m[logging renamed] ${filename}\x1b[0m\n`;
  }

  async function startLogging(tabId: string, defaultLogFolder: string | null, requestedName: string | null = null): Promise<void> {
    const session = getWorldSession(tabId);
    if (!session.currentWorld || !session.currentCharacter || session.loggingActive) {
      return;
    }

    if (!isTauriAvailable()) {
      return;
    }

    const fileName = requestedName && requestedName.trim()
      ? requestedName.trim()
      : generateLogFilename(session.currentWorld.name, session.currentCharacter.name);
    const initialText = stripTranscriptForLog(session.outputChunks.join(''));

    try {
      const result = await invoke<CreateSessionLogResult>('create_session_log', {
        folder: defaultLogFolder,
        fileName,
        initialText,
      });

      updateWorldSession(tabId, {
        loggingActive: true,
        logFilePath: result.path,
        logFolderPath: result.path.replace(/[\\/][^\\/]*$/, ''),
        logError: null,
      });

      await appendSystemMessageToTab(tabId, buildLogStartMessage(getLogFileName(result.path), result.appended));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateWorldSession(tabId, { logError: message });
      await appendSystemMessageToTab(tabId, `\x1b[31m[logging failed] ${message}\x1b[0m\n`);
    }
  }

  async function stopLogging(tabId: string): Promise<void> {
    const session = getWorldSession(tabId);
    if (!session.loggingActive) {
      return;
    }

    if (!isTauriAvailable()) {
      updateWorldSession(tabId, {
        loggingActive: false,
        logError: null,
      });
      return;
    }

    await appendSystemMessageToTab(tabId, buildLogStopMessage());
    updateWorldSession(tabId, {
      loggingActive: false,
      logError: null,
    });
  }

  async function renameLogging(tabId: string, nextName: string): Promise<void> {
    const session = getWorldSession(tabId);
    const currentPath = session.logFilePath;
    const trimmedName = nextName.trim();

    if (!session.loggingActive || !currentPath) {
      return;
    }

    if (!trimmedName) {
      const message = 'a new log file name is required';
      updateWorldSession(tabId, { logError: message });
      await appendSystemMessageToTab(tabId, `\x1b[31m[log rename failed] ${message}\x1b[0m\n`);
      return;
    }

    if (!isTauriAvailable()) {
      return;
    }

    try {
      await enqueueLogWrite(tabId, async () => {
        const path = await invoke<string>('rename_session_log', {
          path: currentPath,
          nextPath: trimmedName,
        });

        updateWorldSession(tabId, {
          logFilePath: path,
          logFolderPath: path.replace(/[\\/][^\\/]*$/, ''),
          logError: null,
        });

        await appendSystemMessageToTab(tabId, buildLogRenameMessage(getLogFileName(path)));
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateWorldSession(tabId, { logError: message });
      await appendSystemMessageToTab(tabId, `\x1b[31m[log rename failed] ${message}\x1b[0m\n`);
    }
  }

  async function revealLoggingFile(tabId: string): Promise<void> {
    const session = getWorldSession(tabId);
    if (!session.logFilePath) {
      return;
    }

    if (!isTauriAvailable()) {
      return;
    }

    try {
      await invoke('reveal_session_log_file', { path: session.logFilePath });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      updateWorldSession(tabId, { logError: message });
      await appendSystemMessageToTab(tabId, `\x1b[31m[failed to reveal log file] ${message}\x1b[0m\n`);
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

    const activeWorldTabId = getActiveWorldTabId();
    if (activeWorldTabId === null) {
      return;
    }

    const session = getWorldSession(activeWorldTabId);

    if (event.ctrlKey && event.key === 'F2') {
      event.preventDefault();

      const secondBar = session.inputBars[1];
      if (!secondBar) {
        return;
      }

      const scope = getWorldDomScope(activeWorldTabId);
      const container = document.getElementById(getWorldInputBarContainerId(scope, secondBar.id));
      const closeButton = container?.querySelector<HTMLButtonElement>('[aria-label="close input bar"]');
      closeButton?.click();
      return;
    }

    if (event.key === 'F1' || event.key === 'F2') {
      event.preventDefault();
      const hotkeyBar = session.inputBars.find((bar) => bar.label === event.key);

      if (hotkeyBar) {
        updateWorldSession(activeWorldTabId, { activeBar: hotkeyBar.id });
        const scope = getWorldDomScope(activeWorldTabId);
        focusElement(getWorldInputBarInputId(scope, hotkeyBar.id));
        return;
      }

      if (event.key === 'F2' && session.inputBars.length === 1) {
        void addInputBarAfter(session.inputBars[0].id);
      }

      return;
    }

    if (event.key === 'F3') {
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
          void appendConnectionStatusToTab(tabId, `\x1b[90m[connected to ${world.host}:${world.port}]\x1b[0m\n`);
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
          void appendConnectionStatusToTab(tabId, '\x1b[90m[disconnected - reconnect available]\x1b[0m\n');
        },
        onError: (message) => {
          updateWorldSession(tabId, { connectionStatus: 'disconnected', disconnectReason: 'error' });
          void appendConnectionStatusToTab(tabId, `\x1b[31m[connection error] ${message}\x1b[0m\n`);
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

    void appendConnectionStatusToTab(tabId, '\x1b[90m[disconnected]\x1b[0m\n');

    await closeWorldTabConnection(tabId);
  }

  function handleOutputScroll(): void {
    if (suppressTranscriptScrollState) {
      return;
    }

    const scope = getActiveWorldScope();
    if (!scope) {
      return;
    }

    const outputEl = document.getElementById(getWorldOutputAreaId(scope));

    if (!outputEl) {
      return;
    }

    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    updateOutputScrollState(tabId, outputEl);
  }

  function handleOutputScrollKey(action: 'top' | 'bottom' | 'page-up' | 'page-down'): void {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const scope = getActiveWorldScope();
    if (!scope) {
      return;
    }

    const outputEl = document.getElementById(getWorldOutputAreaId(scope));
    if (!(outputEl instanceof HTMLElement)) {
      return;
    }

    if (action === 'top') {
      scrollElementToTop(getWorldOutputAreaId(scope));
      updateOutputScrollState(tabId, outputEl);
      return;
    }

    if (action === 'bottom') {
      scrollElementToBottom(getWorldOutputAreaId(scope));
      updateOutputScrollState(tabId, outputEl);
      return;
    }

    if (action === 'page-up') {
      scrollElementBy(getWorldOutputAreaId(scope), -outputEl.clientHeight);
      updateOutputScrollState(tabId, outputEl);
      return;
    }

    if (action === 'page-down') {
      scrollElementBy(getWorldOutputAreaId(scope), outputEl.clientHeight);
      updateOutputScrollState(tabId, outputEl);
    }
  }

  function handleScrollToBottom(): void {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    updateWorldSession(tabId, { userScrolled: false });
    const scope = getWorldDomScope(tabId);
    void nextFrame().then(() => {
      scrollElementToBottom(getWorldOutputAreaId(scope));
    });
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
    const shouldPreserveBottom = !session.userScrolled;

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

    suppressTranscriptScrollState = true;
    try {
      await nextFrame();

      if (shouldPreserveBottom) {
        const scope = getActiveWorldScope();
        if (scope) {
          scrollElementToBottom(getWorldOutputAreaId(scope));
        }
      }

      await nextFrame();

      if (shouldOpen) {
        const scope = getActiveWorldScope();
        if (scope) {
          focusElement(panel === 'notes' ? getWorldNotesEditorId(scope) : getWorldHighlightInputId(scope), true);
        }
      } else {
        focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), session.activeBar));
      }
    } finally {
      suppressTranscriptScrollState = false;
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
    const next = [
      ...state.highlights,
      {
        pattern: trimmed,
        color,
        caseSensitive: false,
        wordBoundary: true,
      },
    ];
    void saveHighlights(next);
    setHighlightRegexes(buildHighlightRegexes(next));
    patch({ highlights: next });
  }

  function updateHighlight(index: number, updater: (rule: HighlightRule) => HighlightRule): void {
    const state = getState();
    const current = state.highlights[index];
    if (!current) {
      return;
    }

    const next = [...state.highlights];
    next[index] = updater(current);
    void saveHighlights(next);
    setHighlightRegexes(buildHighlightRegexes(next));
    patch({ highlights: next });
  }

  function updateHighlightPattern(index: number, pattern: string): void {
    const trimmed = pattern.trim();
    if (!trimmed) {
      return;
    }

    updateHighlight(index, (rule) => ({
      ...rule,
      pattern: trimmed,
    }));
  }

  function updateHighlightColor(index: number, color: string): void {
    if (!color.trim()) {
      return;
    }

    updateHighlight(index, (rule) => ({
      ...rule,
      color,
    }));
  }

  function toggleHighlightCaseSensitive(index: number): void {
    updateHighlight(index, (rule) => ({
      ...rule,
      caseSensitive: !rule.caseSensitive,
    }));
  }

  function toggleHighlightWordBoundary(index: number): void {
    updateHighlight(index, (rule) => ({
      ...rule,
      wordBoundary: !rule.wordBoundary,
    }));
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
    startLogging,
    stopLogging,
    renameLogging,
    revealLoggingFile,
    clearLoggingQueue,
    handleOutputScroll,
    handleOutputScrollKey,
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
    updateHighlightPattern,
    updateHighlightColor,
    toggleHighlightCaseSensitive,
    toggleHighlightWordBoundary,
    deleteHighlight,
    saveNotes,
  };
}
