import { buildHighlightRegexes } from './formatting';
import { loadNotes, loadTranscriptHistory } from './storage';
import { playBeep } from './playback';
import { DEFAULT_OUTPUT_HISTORY_LINES, type SessionState } from './session-state';
import { focusElement } from './session-dom';
import type { CharacterRecord, WorldRecord } from './types';
import type { WorldSessionContainerRegistry } from './world-session-container';
import type { WorldTabSessionState } from './world-session';
import { getWorldDomScope, getWorldInputBarInputId } from './world-dom';

interface WorldConnectionActionContext {
  getState: () => SessionState;
  getWorldSession: (tabId: string) => WorldTabSessionState;
  ensureWorldSession: (tabId: string) => WorldTabSessionState;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
  activateWorldTab: (tabId: string) => void;
  worldSessionContainers: WorldSessionContainerRegistry;
  ensureWorldTab: (world: WorldRecord, character?: CharacterRecord | null) => string;
  appendOutputToTab: (tabId: string, rawText: string) => Promise<void>;
  appendIncomingRawMessageToTab: (tabId: string, text: string) => void;
  captureIncomingWorldLine: (tabId: string, text: string) => void;
  appendDebugConsoleMessageToTab: (tabId: string, direction: 'incoming' | 'outgoing' | 'status', text: string) => void;
  appendConnectionStatusToTab: (tabId: string, rawText: string) => Promise<void>;
  setHighlightRegexes: (regexes: ReturnType<typeof buildHighlightRegexes>) => void;
}

function isAppFocused(): boolean {
  return typeof document !== 'undefined' && !document.hidden && document.hasFocus();
}

function getHighlightTriggers(triggers: SessionState['triggers']) {
  return triggers.filter((trigger) => trigger.type === 'highlight');
}

export function createWorldConnectionActions({
  getState,
  getWorldSession,
  ensureWorldSession,
  updateWorldSession,
  activateWorldTab,
  worldSessionContainers,
  ensureWorldTab,
  appendOutputToTab,
  appendIncomingRawMessageToTab,
  captureIncomingWorldLine,
  appendDebugConsoleMessageToTab,
  appendConnectionStatusToTab,
  setHighlightRegexes,
}: WorldConnectionActionContext) {
  async function connectToTarget(world: WorldRecord, character: CharacterRecord | null): Promise<void> {
    const tabId = ensureWorldTab(world, character);
    const session = ensureWorldSession(tabId);
    const stateSnapshot = getState();
    const tab = stateSnapshot.tabs.find(
      (entry): entry is Extract<(typeof stateSnapshot.tabs)[number], { kind: 'world' }> =>
        entry.id === tabId && entry.kind === 'world',
    );
    const connection = tab ? worldSessionContainers.connection.ensureByTabId(tabId, tab.connectionId) : null;

    if (!connection) {
      return;
    }

    const activeBar = session.activeBar ?? session.inputBars[0]?.id ?? 1;
    const shouldInitializeSession = session.currentWorld === null;

    if (shouldInitializeSession) {
      const maxHistoryLines = character?.outputHistoryLines ?? DEFAULT_OUTPUT_HISTORY_LINES;
      const highlightRegexes = buildHighlightRegexes(getHighlightTriggers(stateSnapshot.triggers));
      const [notes, history] = character
        ? await Promise.all([
            loadNotes(character.id, false),
            loadTranscriptHistory(character.id, maxHistoryLines, false),
          ])
        : ['', []];

      session.transcript.loadHistory(maxHistoryLines > 0 ? history : []);
      setHighlightRegexes(highlightRegexes);

      updateWorldSession(tabId, {
        currentWorld: world,
        currentCharacter: character,
        notesVisible: false,
        highlightsVisible: false,
        connectionStatus: 'connecting',
        disconnectReason: null,
        hasNewActivity: false,
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
          if (character?.connectString && character.connectString.trim()) {
            appendDebugConsoleMessageToTab(tabId, 'outgoing', `${character.connectString}\r\n`);
            connection.send(`${character.connectString}\r\n`);
          }
          updateWorldSession(tabId, { connectionStatus: 'connected', disconnectReason: null });
          void appendConnectionStatusToTab(tabId, `\x1b[90m[connected to ${world.host}:${world.port}]\x1b[0m\n`);
        },
        onRawMessage: (text) => {
          appendIncomingRawMessageToTab(tabId, text);
        },
        onMessage: (text) => {
          captureIncomingWorldLine(tabId, text);
          const current = getWorldSession(tabId);
          const shouldPlayActivitySound = !isAppFocused() && !current.hasNewActivity;

          void appendOutputToTab(tabId, text);

          if (shouldPlayActivitySound && character?.sound) {
            playBeep();
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

  async function connectToWorld(worldId: string): Promise<void> {
    const current = getState();
    const world = current.worlds.find((entry) => entry.id === worldId);
    if (!world) {
      return;
    }

    await connectToTarget(world, null);
  }

  async function connectToCharacter(index: number): Promise<void> {
    const current = getState();
    const character = current.characters[index];
    if (!character) {
      return;
    }

    const world = current.worlds.find((entry) => entry.id === character.worldId);
    if (!world) {
      return;
    }

    await connectToTarget(world, character);
  }

  async function reconnectWorldTab(tabId: string): Promise<void> {
    const current = getState();
    const tab = current.tabs.find((entry) => entry.id === tabId);
    const session = getWorldSession(tabId);

    if (!tab || tab.kind !== 'world' || !session.currentWorld) {
      return;
    }

    if (!session.currentCharacter) {
      await connectToTarget(session.currentWorld, null);
    } else {
      const characterIndex = current.characters.findIndex((character) => character.id === session.currentCharacter?.id);
      if (characterIndex < 0) {
        return;
      }

      await connectToCharacter(characterIndex);
    }
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

    await worldSessionContainers.connection.closeByTabId(tabId);
  }

  return {
    connectToWorld,
    connectToCharacter,
    reconnectWorldTab,
    disconnectWorldTab,
  };
}
