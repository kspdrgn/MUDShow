import { appServices } from './app-services';
import { bumpDebugConsoleCache } from './debug-console-cache';
import { buildHighlightRegexes } from './formatting';
import { playBeep } from './playback';
import { DEFAULT_OUTPUT_HISTORY_LINES, type SessionState } from './session-state';
import { focusElement } from './session-dom';
import type { CharacterRecord, WorldRecord } from './types';
import type { WorldSessionContainerRegistry } from './world-session-container';
import { createWorldSessionKey } from './world-session-container';
import type { WorldTabSessionState } from './world-session';
import { getWorldDomScope, getWorldInputBarInputId } from './world-dom';
import { setWorldNotes } from './session-world-input';
import type { WorldPluginSession } from './world-plugin-registry';
import type { ConnectionSnapshot, StructuredConnectionEvent } from './connection';

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
  appendConnectionStatusToTab: (tabId: string, rawText: string) => Promise<void>;
  setHighlightRegexes: (regexes: ReturnType<typeof buildHighlightRegexes>) => void;
  getWorldPluginSession: (tabId: string, world: WorldRecord, character: CharacterRecord | null) => WorldPluginSession | null;
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
  appendConnectionStatusToTab,
  setHighlightRegexes,
  getWorldPluginSession,
}: WorldConnectionActionContext) {
  async function connectToTarget(world: WorldRecord, character: CharacterRecord | null): Promise<void> {
    const tabId = ensureWorldTab(world, character);
    const session = ensureWorldSession(tabId);
    const stateSnapshot = getState();
    const tab = stateSnapshot.tabs.find(
      (entry): entry is Extract<(typeof stateSnapshot.tabs)[number], { kind: 'world' }> =>
        entry.id === tabId && entry.kind === 'world',
    );
    const connection = tab
      ? worldSessionContainers.connection.ensure(createWorldSessionKey(world.id, character?.id ?? null), tab.connectionId)
      : null;

    if (!connection) {
      return;
    }

    const pluginSession = getWorldPluginSession(tabId, world, character);

    const updateConnectionDiagnostics = (patch: Partial<WorldTabSessionState['connectionDiagnostics']>) => {
      const current = getWorldSession(tabId).connectionDiagnostics;
      updateWorldSession(tabId, {
        connectionDiagnostics: { ...current, ...patch },
      });
    };

    const debugConsole = worldSessionContainers.debugConsole.ensure(createWorldSessionKey(world.id, character?.id ?? null));
    debugConsole.sourceLabel = character ? `${world.name} · ${character.name}` : world.name;
    bumpDebugConsoleCache();

    const activeBar = session.activeBar ?? session.inputBars[0]?.id ?? 1;
    const shouldInitializeSession = session.currentWorld === null;

    const maxHistoryLines = character?.outputHistoryLines ?? DEFAULT_OUTPUT_HISTORY_LINES;
    const highlightRegexes = buildHighlightRegexes(getHighlightTriggers(stateSnapshot.triggers));
    const [notes, history] = character
      ? await Promise.all([
          appServices.storage.loadNotes(character.id, false),
          appServices.storage.loadTranscriptHistory(character.id, maxHistoryLines, false),
        ])
      : ['', []];

    session.transcript.loadHistory(maxHistoryLines > 0 ? history : []);
    setWorldNotes(tabId, notes);
    setHighlightRegexes(highlightRegexes);

    if (shouldInitializeSession) {
      
      updateWorldSession(tabId, {
        currentWorld: world,
        currentCharacter: character,
        connectionStatus: 'connecting',
        disconnectReason: null,
        hasNewActivity: false,
        lastActivityMarker: null,
        outputRevision: session.outputRevision + 1,
        userScrolled: false,
        activeBar,
        transcriptHistory: history,
      });
    } else {
      updateWorldSession(tabId, {
        currentWorld: world,
        currentCharacter: character,
        connectionStatus: 'connecting',
        disconnectReason: null,
        hasNewActivity: false,
        lastActivityMarker: null,
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
            connection.send(`${character.connectString}\r\n`);
          }
          updateWorldSession(tabId, { connectionStatus: 'connected', disconnectReason: null });
          pluginSession?.handleConnected();
          void appendConnectionStatusToTab(tabId, `\x1b[90m[connected to ${world.host}:${world.port}]\x1b[0m\n`);
        },
        onRawMessage: (text) => {
          pluginSession?.handleRawMessage(text);
          appendIncomingRawMessageToTab(tabId, text);
        },
        onStructured: (event: StructuredConnectionEvent) => {
          updateConnectionDiagnostics({ structuredSync: event.parseStatus === 'parsed' ? 'current' : 'stale' });
        },
        onSnapshot: (snapshot: ConnectionSnapshot) => {
          updateConnectionDiagnostics({
            runtimeId: snapshot.runtimeId,
            connectionId: snapshot.connectionId,
            sessionId: snapshot.sessionId,
            lastSequence: snapshot.sequence,
            structuredSync: 'current',
            lastError: snapshot.snapshot.diagnostics.at(-1) ?? null,
          });
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
          pluginSession?.handleDisconnected();
          void appendConnectionStatusToTab(tabId, '\x1b[90m[disconnected - reconnect available]\x1b[0m\n');
        },
        onError: (message) => {
          updateConnectionDiagnostics({ structuredSync: 'failed', lastError: message });
          updateWorldSession(tabId, { connectionStatus: 'disconnected', disconnectReason: 'error' });
          pluginSession?.handleDisconnected();
          void appendConnectionStatusToTab(tabId, `\x1b[31m[connection error] ${message}\x1b[0m\n`);
        },
        onDiagnostic: (message) => {
          updateConnectionDiagnostics({ structuredSync: 'stale', lastError: message });
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

    const connection = worldSessionContainers.connection.get(createWorldSessionKey(tab.worldId, tab.characterId));
    if (connection) {
      await connection.close();
    }
  }

  return {
    connectToWorld,
    connectToCharacter,
    reconnectWorldTab,
    disconnectWorldTab,
  };
}
