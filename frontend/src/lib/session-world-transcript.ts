import { bumpDebugConsoleCache } from './debug-console-cache';
import {
  appendDebugConsoleEntry,
  type DebugConsoleDirection,
} from './debug-console';
import { appServices } from './app-services';
import {
  formatStatusMessageForLog,
  generateLogFilename,
  getLogFileName,
  stripTranscriptForLog,
} from './logging';
import { isTauriAvailable, invoke } from './tauri';
import { nextFrame, scrollElementToBottom } from './session-dom';
import { selectLastActivityMarker, type LastActivityMarker } from './transcript-indicators';
import type { SessionState } from './session-state';
import type { WorldTabSessionState } from './world-session';
import type { WorldSessionContainerRegistry } from './world-session-container';
import type { WorldSessionKey } from './world-session-registry';
import { getWorldDomScope, getWorldOutputAreaId } from './world-dom';

interface WorldTranscriptActionContext {
  getState: () => SessionState;
  patch: (patch: Partial<SessionState>) => void;
  getActiveWorldTabId: () => string | null;
  getActiveWorldScope: () => string | null;
  getWorldSession: (tabId: string) => WorldTabSessionState;
  getWorldSessionKeyForTab: (tabId: string) => WorldSessionKey | null;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
  worldSessionContainers: WorldSessionContainerRegistry;
}

interface CreateSessionLogResult {
  path: string;
  appended: boolean;
}

export function createWorldTranscriptActions({
  getState,
  patch,
  getActiveWorldTabId,
  getActiveWorldScope,
  getWorldSession,
  getWorldSessionKeyForTab,
  updateWorldSession,
  worldSessionContainers,
}: WorldTranscriptActionContext) {
  const logWriteQueues = new Map<string, Promise<void>>();

  function clearLoggingQueue(tabId: string): void {
    logWriteQueues.delete(tabId);
  }

  function clearActiveTabActivity(): void {
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

  function noteOutputActivity(tabId: string, activityMarker: LastActivityMarker | null): void {
    const activeTabId = getActiveWorldTabId();
    const appFocused = appServices.windowAttention.isAppFocused();

    if (activeTabId !== tabId || !appFocused) {
      const current = getWorldSession(tabId);
      const firstRetainedChunk = current.transcript.getChunk(0);
      updateWorldSession(tabId, {
        hasNewActivity: true,
        lastActivityMarker: selectLastActivityMarker(
          current.lastActivityMarker,
          current.hasNewActivity,
          activityMarker,
          firstRetainedChunk?.id ?? null,
        ),
      });
    }

    if (!appFocused) {
      appServices.windowAttention.requestAttention(true);
    }
  }

  function enqueueLogWrite(tabId: string, work: () => Promise<void>): Promise<void> {
    const previous = logWriteQueues.get(tabId) ?? Promise.resolve();
    const next = previous.catch(() => undefined).then(work);

    logWriteQueues.set(tabId, next.catch(() => undefined));
    return next;
  }

  function getDebugConsoleSourceLabel(tabId: string): string {
    const session = getWorldSession(tabId);
    const worldName = session.currentWorld?.name ?? 'unknown world';
    const characterName = session.currentCharacter?.name;

    return characterName ? `${worldName} · ${characterName}` : worldName;
  }

  function appendDebugConsoleMessageToTab(
    tabId: string,
    direction: DebugConsoleDirection,
    text: string,
  ): void {
    if (!text) {
      return;
    }

    const sessionKey = getWorldSessionKeyForTab(tabId);
    if (!sessionKey) {
      return;
    }

    const session = getWorldSession(tabId);
    const debugConsole = worldSessionContainers.debugConsole.ensure(sessionKey);
    debugConsole.entries = appendDebugConsoleEntry(debugConsole.entries, {
      direction,
      sourceLabel: getDebugConsoleSourceLabel(tabId),
      text,
    });
    bumpDebugConsoleCache();
  }

  async function appendOutputToTab(tabId: string, rawText: string): Promise<void> {
    const session = getWorldSession(tabId);
    const maxHistoryLines = session.currentCharacter?.outputHistoryLines ?? 0;

    session.transcript.append(rawText);
    const appendedChunk = session.transcript.getChunk(session.transcript.getChunkCount() - 1);
    const firstRetainedChunk = session.transcript.getChunk(0);
    const activityMarker = appendedChunk
      ? { boundary: { chunkId: appendedChunk.id, side: 'before' as const }, timestamp: appendedChunk.timestamp }
      : null;

    if (session.currentCharacter && maxHistoryLines > 0) {
      const sessionKey = getWorldSessionKeyForTab(tabId);
      if (sessionKey) {
        const transcriptService = worldSessionContainers.transcript.ensure(sessionKey);
        transcriptService.appendHistory(rawText, maxHistoryLines);
        transcriptService.saveHistory(maxHistoryLines);
      }
    }

    updateWorldSession(tabId, {
      outputRevision: session.outputRevision + 1,
      ...(session.lastActivityMarker && firstRetainedChunk && session.lastActivityMarker.boundary.chunkId < firstRetainedChunk.id
        ? { lastActivityMarker: null }
        : {}),
    });
    noteOutputActivity(tabId, activityMarker);

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
    const session = getWorldSession(tabId);

    session.transcript.append(text);
    const appendedChunk = session.transcript.getChunk(session.transcript.getChunkCount() - 1);
    const firstRetainedChunk = session.transcript.getChunk(0);
    const activityMarker = appendedChunk
      ? { boundary: { chunkId: appendedChunk.id, side: 'before' as const }, timestamp: appendedChunk.timestamp }
      : null;
    appendDebugConsoleMessageToTab(tabId, 'status', text);

    updateWorldSession(tabId, {
      outputRevision: session.outputRevision + 1,
      ...(session.lastActivityMarker && firstRetainedChunk && session.lastActivityMarker.boundary.chunkId < firstRetainedChunk.id
        ? { lastActivityMarker: null }
        : {}),
    });
    noteOutputActivity(tabId, activityMarker);

    const strippedText = stripTranscriptForLog(text);
    const logText = strippedText.length > 0 ? formatStatusMessageForLog(strippedText) : '';
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

  function appendIncomingRawMessageToTab(tabId: string, text: string): void {
    appendDebugConsoleMessageToTab(tabId, 'incoming', text);
  }

  function appendDebugConsoleMessageToTabPublic(
    tabId: string,
    direction: DebugConsoleDirection,
    text: string,
  ): void {
    appendDebugConsoleMessageToTab(tabId, direction, text);
  }

  async function appendConnectionStatusToTab(tabId: string, rawText: string): Promise<void> {
    await appendSystemMessageToTab(tabId, rawText);
  }

  function buildLogStartMessage(filename: string, appended: boolean): string {
    return `\x1b[90m[logging started] ${filename}${appended ? ' [appending]' : ''}\x1b[0m\n`;
  }

  function buildLogStopMessage(path: string): string {
    return `\x1b[90m[logging stopped] ${path}\x1b[0m\n`;
  }

  function buildLogRenameMessage(filename: string): string {
    return `\x1b[90m[logging renamed] ${filename}\x1b[0m\n`;
  }

  async function startLogging(tabId: string, defaultLogFolder: string | null, requestedName: string | null = null): Promise<void> {
    const session = getWorldSession(tabId);
    if (!session.currentWorld || session.loggingActive) {
      return;
    }

    if (!isTauriAvailable()) {
      return;
    }

    const fileName = requestedName && requestedName.trim()
      ? requestedName.trim()
      : generateLogFilename(session.currentWorld.name, session.currentCharacter?.name ?? 'world');
    const initialText = stripTranscriptForLog(session.transcript.getText());

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

      console.debug('[logging] started', {
        tabId,
        path: result.path,
        appended: result.appended,
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
    const currentPath = session.logFilePath;
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

    await appendSystemMessageToTab(tabId, buildLogStopMessage(currentPath ?? 'unknown log file'));
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

        console.debug('[logging] renamed', {
          tabId,
          path,
          fromPath: currentPath,
          nextName: trimmedName,
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
      appServices.windowAttention.requestAttention(false);
      clearActiveTabActivity();
    }
  }

  function handleWindowFocus(): void {
    appServices.windowAttention.requestAttention(false);
    clearActiveTabActivity();
  }

  return {
    clearLoggingQueue,
    handleVisibilityChange,
    handleWindowFocus,
    appendOutputToTab,
    appendSystemMessageToTab,
    appendIncomingRawMessageToTab,
    appendDebugConsoleMessageToTab: appendDebugConsoleMessageToTabPublic,
    appendConnectionStatusToTab,
    startLogging,
    stopLogging,
    renameLogging,
    revealLoggingFile,
  };
}
