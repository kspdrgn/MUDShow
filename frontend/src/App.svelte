<script lang="ts">
import { onMount, tick } from 'svelte';
import { appServices } from './lib/app-services';
import AppNoticeHost from './lib/components/app-notice/AppNoticeHost.svelte';
import WorldsAndCharactersEditor from './lib/components/settings/WorldsAndCharactersEditor.svelte';
import CharacterModal from './lib/components/settings/CharacterModal.svelte';
import ConfirmCloseTabModal from './lib/components/window/ConfirmCloseTabModal.svelte';
import HomePanel from './lib/components/window/HomePanel.svelte';
import LoggingModal from './lib/components/play/LoggingModal.svelte';
import NoticeModal from './lib/components/window/NoticeModal.svelte';
import PlayScreen from './lib/components/play/PlayScreen.svelte';
import type {
  DockviewDebugConsolePanelDefinition,
  DockviewDummyWindowPanelDefinition,
  DockviewNotesPanelDefinition,
  DockviewTreeDataPanelDefinition,
} from './lib/components/play/dockview-panel-props';
import type { DockviewPanelPlacement } from './lib/components/play/dockview-panel-types';
import SettingsPage from './lib/components/settings/SettingsPage.svelte';
import TriggersPane from './lib/components/settings/TriggersPane.svelte';
import DummyWindowContent from './lib/components/window-host/DummyWindowContent.svelte';
import TreeDataWindow from './lib/components/tree-data/TreeDataWindow.svelte';
import {
  createDemoTreeDataWindowModel,
} from './lib/components/tree-data/tree-data-demo-fixture';
import {
  type TreeDataWindowSnapshot,
  type TreeDataWindowTransportSession,
} from './lib/components/tree-data/tree-data-transport';
import {
  type TreeDataWindowModel,
} from './lib/components/tree-data/tree-data-view';
import {
  createTreeDataViewControllerRegistry,
  type TreeDataWindowCommand,
  type TreeDataWindowViewState,
} from './lib/components/tree-data/tree-data-controller';
import { createFuzzballSurfaceHostAdapter } from './lib/fuzzball/surface-host-adapter';
import { debugConsoleCache } from './lib/debug-console-cache';
import PoppedOutWindowView from './lib/components/window-host/PoppedOutWindowView.svelte';
import { createWindowRecord, type WindowRecord } from './lib/components/window-host/window-host';
import TopBar from './lib/components/window/TopBar.svelte';
import WindowResizeHandles from './lib/components/window/WindowResizeHandles.svelte';
import WorldModal from './lib/components/settings/WorldModal.svelte';
import { session } from './lib/session';
import { generateLogFilename, getLogFileName } from './lib/logging';
import { createSurfaceTransportHub } from './lib/surfaces/surface-transport';
import type { OpenSurfaceOptions, SurfaceEdge } from './lib/surfaces/surface-registry';
import DebugConsoleWindow from './lib/components/debug-console/DebugConsoleWindow.svelte';
import {
  buildDebugConsoleWindowModel,
  createDebugConsoleWindowPlaceholderModel,
} from './lib/components/debug-console/debug-console-controller';
import NotesWindow from './lib/components/notes/NotesWindow.svelte';
import {
  buildNotesWindowModel,
  createNotesWindowPlaceholderModel,
} from './lib/components/notes/notes-controller';
import {
  createDebugConsoleBridgeSession,
  getDebugConsoleBridgeSnapshotEventName,
  type DebugConsoleBridgeSession,
} from './lib/components/debug-console/debug-console-bridge';
import type {
  DebugConsoleWindowCommand,
  DebugConsoleWindowSnapshot,
  DebugConsoleWindowTransportSession,
} from './lib/components/debug-console/debug-console-transport';
import {
  createNotesBridgeSession,
  getNotesBridgeSnapshotEventName,
  type NotesBridgeSession,
} from './lib/components/notes/notes-bridge';
import type {
  NotesWindowCommand,
  NotesWindowSnapshot,
  NotesWindowTransportSession,
} from './lib/components/notes/notes-transport';
import {
  createTreeDataBridgeSession,
  getTreeDataBridgeSnapshotEventName,
  type SurfaceTransportBridgeCommandEnvelope,
  type SurfaceTransportBridgeLifecycleEnvelope,
} from './lib/surfaces/tree-data-bridge';
import type { SurfaceEnvelopeBase } from './lib/surfaces/surface-transport';
import type { AppTab } from './lib/tabs';
import type { WorldTabSessionState } from './lib/world-session';
import type { WorldSessionDebugConsole } from './lib/world-session-debug-console';
import { createWorldSessionKey } from './lib/world-session-container';
import { getTriggersForCharacter, getTriggersForWorld } from './lib/triggers';
import { flushPendingNotesSave } from './lib/session-world-input';
import { emit, getCurrentWebviewWindow, invoke, listen } from './lib/tauri';
import { getDockviewTheme } from './lib/dockview-themes';
import {
  createWorldSurfaceCommandRouter,
  createWorldSurfaceSnapshotStore,
  WORLD_SURFACE_PROTOCOL_VERSION,
  type WorldSurfaceJsonValue,
  type WorldSurfacePayload,
} from './lib/world-surface-protocol';

const currentUrl = typeof window !== 'undefined' ? new URL(window.location.href) : null;
const initialWindowMode = currentUrl?.searchParams.get('windowMode');
const initialPoppedOutWindowId = currentUrl?.searchParams.get('windowId');
const initialIsPoppedOutWindow = initialWindowMode === 'popout' && initialPoppedOutWindowId !== null;
const APP_NOTICE_SURFACE_IDS = {
  characterModal: 'character-modal',
  worldModal: 'world-modal',
  loggingModal: 'logging-modal',
  storageImportNotice: 'storage-import-notice',
  worldCloseConfirm: 'world-close-confirm',
  appCloseConfirm: 'app-close-confirm',
  deleteConfirm: 'delete-confirm',
  triggerDiscardConfirm: 'trigger-discard-confirm',
} as const;
const WINDOW_HOST_SINGLETON_IDS = {
  dummyWindow: 'app-dev-dummy',
  treeDataDemo: 'tree-data-demo',
  loggingModal: 'logging-modal',
  worldModal: 'world-modal',
  characterModal: 'character-modal',
} as const;
const DEBUG_CONSOLE_WINDOW_SURFACE_PREFIX = 'debug-console:';
const DEBUG_CONSOLE_WINDOW_ID_PREFIX = 'debug-console-window-';
const NOTES_WINDOW_SURFACE_PREFIX = 'notes:';
const NOTES_WINDOW_ID_PREFIX = 'notes-window-';

const appSettingsStore = appServices.settings.current;
$: appThemeClassName = getDockviewTheme($appSettingsStore.colorScheme).className;
const appNoticeStore = appServices.notice.current;
let loggingModalTabId: string | null = null;
let activeTab: AppTab | null = null;
let activeWorldSession: WorldTabSessionState | null = null;
let loggingModalSession: WorldTabSessionState | null = null;
let loggingModalTab: AppTab | null = null;
let loggingModalInitialFileName = '';
let loggingModalRefreshNonce = 0;
let poppedOutWindowRecords: Record<string, WindowRecord> = {};
let poppedOutWindowId: string | null = initialPoppedOutWindowId ?? null;
let poppedOutWindowRecord: WindowRecord | null = null;
let isPoppedOutWindow = initialIsPoppedOutWindow;
let nextWindowHostId = 1;
let surfaceRegistryVersion = 0;
let focusSurfaceId: string | null = null;
let focusSurfaceRequestVersion = 0;
let treeDataInvalidationVersion = 0;
let treeDataRefreshVersion = 0;
let debugConsoleCacheVersion = 0;
type WorldPluginSurfaceOpenHandler = (
  tabId: string,
  payload?: Readonly<Record<string, unknown>>,
) => void;
type WorldPluginSurfaceSourceWindowProvider = (sourceTabId: string) => readonly string[];
type WorldPluginSurfaceRestoreHandler = (windowId: string, title: string) => boolean;
const worldPluginSurfaceOpenHandlers = new Map<string, WorldPluginSurfaceOpenHandler>();
const worldPluginSurfaceStateDisposers = new Map<string, (instanceId: string) => void>();
const worldPluginSurfaceSourceWindowProviders = new Map<string, WorldPluginSurfaceSourceWindowProvider>();
const worldPluginSurfaceRestoreHandlers = new Map<string, WorldPluginSurfaceRestoreHandler>();
const treeDataViewController = createTreeDataViewControllerRegistry();
const treeDataTransportHub = createSurfaceTransportHub();
const worldSurfaceSnapshotStore = createWorldSurfaceSnapshotStore();
const worldSurfaceCommandRouter = createWorldSurfaceCommandRouter();
const treeDataBridgeSessions = new Map<string, TreeDataWindowTransportSession>();
const treeDataTransportUnlisteners = new Map<string, () => void>();
const treeDataSnapshotUnlisteners = new Map<string, () => void>();
const treeDataSurfaceModelProviders = new Map<string, () => TreeDataWindowModel>();
const treeDataSurfaceCommandHandlers = new Map<string, (command: TreeDataWindowCommand, model: TreeDataWindowModel) => void>();
const treeDataSurfaceSourceTabs = new Map<string, string>();
const treeDataTransportSnapshotSignatures = new Map<string, string>();
const treeDataBridgeSnapshotSignatures = new Map<string, string>();
const debugConsoleTransportHub = createSurfaceTransportHub();
const debugConsoleBridgeSessions = new Map<string, DebugConsoleBridgeSession>();
const debugConsoleTransportUnlisteners = new Map<string, () => void>();
const debugConsoleTransportSnapshotSignatures = new Map<string, string>();
const debugConsoleBridgeSnapshotSignatures = new Map<string, string>();
const notesTransportHub = createSurfaceTransportHub();
const notesBridgeSessions = new Map<string, NotesBridgeSession>();
const notesTransportUnlisteners = new Map<string, () => void>();
const notesTransportSnapshotSignatures = new Map<string, string>();
const notesBridgeSnapshotSignatures = new Map<string, string>();
let previousWorldTabIds = new Set<string>();
let allowWindowCloseOnce = false;
let unlistenAppClose: (() => void) | null = null;
let unlistenTreeBridgeEvents: Array<() => void> = [];

type TreeDataWindowRenderProps = {
  model: TreeDataWindowModel;
  viewState: TreeDataWindowViewState;
  transportSession: TreeDataWindowTransportSession | null;
  onCommand: (command: TreeDataWindowCommand) => void;
};

function getRegisteredWindowRecords(): WindowRecord[] {
  const registeredRecords = appServices.surfaces.getSnapshot().instances
    .filter((instance) => instance.placement.host === 'dockview')
    .map((instance) => {
      const registration = appServices.surfaces.getRegistration(instance.surfaceId);
      return createWindowRecord({
        id: instance.instanceId,
        kind: registration?.kind ?? 'builtin',
        surfaceId: instance.surfaceId,
        rendererId: registration?.rendererId,
        title: instance.title,
        isModal: registration?.capabilities.isModal ?? false,
        placement: 'in-app',
        position: instance.position,
        size: instance.size,
        canBackdropDismiss: false,
        canEscapeDismiss: false,
        canPopOut: registration?.capabilities.canPopOut ?? false,
        canMoveInApp: registration?.capabilities.canDock ?? false,
      });
    });

  return [
    ...registeredRecords,
    ...Object.values(poppedOutWindowRecords),
  ];
}

function getDockviewSurfaceTitle(windowRecord: WindowRecord): string {
  return appServices.surfaces.getRegistration(windowRecord.surfaceId)?.defaultTitle ?? windowRecord.title;
}

function getDockviewPlacementMode(instanceId: string): DockviewPanelPlacement {
  const placement = appServices.surfaces.getInstance(instanceId)?.placement;
  return placement?.host === 'dockview' ? placement.mode : 'grid';
}

type DebugConsoleWindowRenderProps = {
  model: DebugConsoleWindowSnapshot['model'];
  transportSession: DebugConsoleWindowTransportSession | null;
  onCommand: (command: DebugConsoleWindowCommand) => void;
};

type NotesWindowRenderProps = {
  model: NotesWindowSnapshot['model'];
  transportSession: NotesWindowTransportSession | null;
  onCommand: (command: NotesWindowCommand) => void;
};

const resolvedAppStyle = appServices.style.resolved;
const spellcheckConfig = appServices.spellcheck.config;

$: {
  session.setConfirmUnloggedTabClose($appSettingsStore.confirmUnloggedTabClose);
  session.setTranscriptScrollbackChunks($appSettingsStore.transcriptScrollbackChunks);
}

$: {
  $spellcheckConfig;
}

function toggleTranscriptDiagnostics(): void {
    session.toggleTranscriptDiagnosticsEnabled();
}

function logTreeTransport(message: string, details: Record<string, unknown>): void {
  console.debug(`[tree-transport] ${message}`, details);
}

function logDebugConsoleTransport(message: string, details: Record<string, unknown>): void {
  console.debug(`[debug-console-transport] ${message}`, details);
}

function logNotesTransport(message: string, details: Record<string, unknown>): void {
  console.debug(`[notes-transport] ${message}`, details);
}

function createTreeDataWindowPlaceholderModel(title: string): TreeDataWindowModel {
  return {
    title,
    description: 'waiting for surface data',
    root: {
      id: `${title}-placeholder-root`,
      title: '/',
      subtitle: 'no data yet',
      badge: 'dir',
      kind: 'branch',
      valueState: 'unknown',
      childrenState: 'missing',
    },
  };
}

function getDebugConsoleWindowId(tabId: string): string {
  return `${DEBUG_CONSOLE_WINDOW_ID_PREFIX}${tabId}`;
}

function getDebugConsoleSurfaceId(tabId: string): string {
  return `${DEBUG_CONSOLE_WINDOW_SURFACE_PREFIX}${tabId}`;
}

function getDebugConsoleTabIdFromSurfaceId(surfaceId: string): string | null {
  if (!surfaceId.startsWith(DEBUG_CONSOLE_WINDOW_SURFACE_PREFIX)) {
    return null;
  }

  return surfaceId.slice(DEBUG_CONSOLE_WINDOW_SURFACE_PREFIX.length) || null;
}

function isDebugConsoleWindow(windowRecord: WindowRecord | null): boolean {
  if (!windowRecord) {
    return false;
  }

  return windowRecord.surfaceId.startsWith(DEBUG_CONSOLE_WINDOW_SURFACE_PREFIX);
}

function createDebugConsoleWindowTitle(tabId: string): string {
  const worldSession = $session.worldSessions[tabId] ?? null;
  const worldName = worldSession?.currentWorld?.name ?? 'debug console';
  const characterName = worldSession?.currentCharacter?.name ?? null;

  return characterName ? `${worldName} · ${characterName} debug console` : `${worldName} debug console`;
}

function createDebugConsoleWindowDescription(tabId: string): string {
  const worldSession = $session.worldSessions[tabId] ?? null;
  const worldName = worldSession?.currentWorld?.name ?? 'unknown world';
  const characterName = worldSession?.currentCharacter?.name ?? null;

  return characterName ? `world: ${worldName} · character: ${characterName}` : `world: ${worldName}`;
}

function getDebugConsoleWindowSourceState(tabId: string): WorldSessionDebugConsole {
  const worldSession = $session.worldSessions[tabId] ?? null;
  const worldId = worldSession?.currentWorld?.id ?? '';
  const characterId = worldSession?.currentCharacter?.id ?? null;

  if (!worldId) {
    return { entries: [], sourceLabel: null };
  }

  const worldSessionContainer = session.worldSessionContainers.debugConsole.get(
    createWorldSessionKey(worldId, characterId),
  );

  return worldSessionContainer ?? { entries: [], sourceLabel: null };
}

function getNotesWindowId(tabId: string): string {
  return `${NOTES_WINDOW_ID_PREFIX}${tabId}`;
}

function getNotesSurfaceId(tabId: string): string {
  return `${NOTES_WINDOW_SURFACE_PREFIX}${tabId}`;
}

function getNotesTabIdFromSurfaceId(surfaceId: string): string | null {
  if (!surfaceId.startsWith(NOTES_WINDOW_SURFACE_PREFIX)) {
    return null;
  }

  return surfaceId.slice(NOTES_WINDOW_SURFACE_PREFIX.length) || null;
}

function isNotesWindow(windowRecord: WindowRecord | null): boolean {
  if (!windowRecord) {
    return false;
  }

  return windowRecord.surfaceId.startsWith(NOTES_WINDOW_SURFACE_PREFIX);
}

function isTreeDataSurfaceWindow(windowRecord: WindowRecord | null): boolean {
  if (!windowRecord) {
    return false;
  }

  return windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.treeDataDemo
    || windowRecord.rendererId === 'tree-data'
    || appServices.surfaces.getRegistration(windowRecord.surfaceId)?.rendererId === 'tree-data';
}

function createNotesWindowTitle(tabId: string): string {
  const worldSession = $session.worldSessions[tabId] ?? null;
  const worldName = worldSession?.currentWorld?.name ?? 'notes';
  const characterName = worldSession?.currentCharacter?.name ?? null;

  return characterName ? `${worldName} · ${characterName} notes` : `${worldName} notes`;
}

function createNotesWindowDescription(tabId: string): string {
  const worldSession = $session.worldSessions[tabId] ?? null;
  const worldName = worldSession?.currentWorld?.name ?? 'unknown world';
  const characterName = worldSession?.currentCharacter?.name ?? null;

  return characterName ? `world: ${worldName} · character: ${characterName}` : `world: ${worldName}`;
}

function getNotesWindowSourceState(tabId: string): Parameters<typeof buildNotesWindowModel>[0] {
  const worldSession = $session.worldSessions[tabId] ?? null;
  const worldId = worldSession?.currentWorld?.id ?? '';
  const characterId = worldSession?.currentCharacter?.id ?? null;

  return {
    sourceTabId: tabId,
    worldId,
    characterId,
    title: createNotesWindowTitle(tabId),
    description: createNotesWindowDescription(tabId),
    notes: session.getWorldNotes(tabId),
  };
}

$: {
    const currentWorldTabIds = new Set(
      $session.tabs
        .filter((tab): tab is AppTab & { kind: 'world' } => tab.kind === 'world')
        .map((tab) => tab.id),
    );

    for (const tabId of previousWorldTabIds) {
      if (!currentWorldTabIds.has(tabId)) {
        void discardPluginSurfaceWindowsForSourceTab(tabId);
        void discardDebugConsoleWindowsForSourceTab(tabId);
        void discardNotesWindowsForSourceTab(tabId);
        void discardTreeDataWindows();
      }
    }

    previousWorldTabIds = currentWorldTabIds;
}

function createPlayScreenActions(tab: AppTab, worldSession: WorldTabSessionState) {
    return {
      onReconnectTab: () => void session.reconnectWorldTab(tab.id),
      onDisconnectTab: () => void session.disconnectWorldTab(tab.id),
      onQuickLogTab: () =>
        void session.startLogging(
          tab.id,
          appServices.storage.getResolvedDefaultLogFolder() ?? $appSettingsStore.defaultLogFolder ?? null,
          null,
        ),
      onOpenLoggingTab: () => openLoggingModal(tab.id),
      onStopLoggingTab: () => void session.stopLogging(tab.id),
      onEditWorldTab: () => void session.openWorldEditorFromWorldTab(tab.id),
      onEditCharacterTab: () => void session.openCharacterEditorFromWorldTab(tab.id),
      onCloseTab: () => session.closeTab(tab.id, 'shortcut'),
      onOpenNotes: () => openOrFocusNotesWindow(tab.id),
      onOpenTriggers: () =>
        session.openTriggersTab(worldSession.currentWorld?.id ?? null, worldSession.currentCharacter?.id ?? null),
      onOpenDebugConsole: () => openOrFocusDebugConsoleWindow(tab.id),
        onOpenStyles: () => openDefaultStyleSettings(),
        onInputFocusBar: (bar: number) => session.handleInputFocus(bar),
        onInputSubmit: (bar: number, value: string) => session.handleInputSubmit(bar, value),
      onInputComplete: (_bar: number, value: string, selectionStart: number) =>
        session.completeInput(value, selectionStart),
      onInputAddBar: (bar: number) => void session.addInputBarAfter(bar),
      onInputRemoveBar: (bar: number) => void session.removeInputBar(bar),
      onInputResizeBar: (bar: number, delta: -1 | 1) => session.resizeInputBar(bar, delta),
      onSpellcheckIgnoreWord: (word: string) => void appServices.spellcheck.ignoreWord(word),
      onOutputScroll: (userInitiated?: boolean) => session.handleOutputScroll(userInitiated),
      onOutputScrollKey: (action: 'top' | 'bottom' | 'page-up' | 'page-down') =>
        session.handleOutputScrollKey(action),
      onScrollToBottom: () => session.handleScrollToBottom(),
    };
}

function handleWorldPluginSurfaceOpen(
  tabId: string,
  pluginId: string,
  surfaceId: string,
  payload?: Readonly<Record<string, unknown>>,
): void {
  const handler = worldPluginSurfaceOpenHandlers.get(`${pluginId}:${surfaceId}`);
  if (!handler) {
    return;
  }

  handler(tabId, payload);
}

function openLoggingModal(tabId: string): void {
    loggingModalTabId = tabId;
    appServices.notice.openNotice({
      kind: 'custom',
      surfaceId: APP_NOTICE_SURFACE_IDS.loggingModal,
      title: 'session logging',
    });
  }

function openDefaultStyleSettings(): void {
    session.selectTab('settings');
    session.setSettingsActiveTab('style');
}

function requestSurfaceFocus(instanceId: string): void {
  focusSurfaceId = instanceId;
  focusSurfaceRequestVersion += 1;
}

function bringSurfaceToFront(instanceId: string): void {
  const instance = appServices.surfaces.update(instanceId, { isActive: true });
  if (instance?.placement.host === 'dockview') {
    requestSurfaceFocus(instanceId);
  }
}

function openSurfaceAndBringToFront(options: OpenSurfaceOptions): void {
  const instance = appServices.surfaces.open(options);
  if (instance.placement.host === 'native') {
    const registration = appServices.surfaces.getRegistration(instance.surfaceId);
    const windowRecord = createWindowRecord({
      id: instance.instanceId,
      kind: registration?.kind ?? 'builtin',
      surfaceId: instance.surfaceId,
      rendererId: registration?.rendererId,
      title: instance.title,
      placement: 'window',
      position: instance.position,
      size: instance.size,
      canBackdropDismiss: false,
      canEscapeDismiss: false,
      canPopOut: registration?.capabilities.canPopOut ?? false,
      canMoveInApp: registration?.capabilities.canDock ?? false,
    });
    storePoppedOutWindowRecord(windowRecord);
    void invoke('window_host_pop_out', { windowRecord }).catch((error) => {
      removePoppedOutWindowRecord(instance.instanceId);
      appServices.surfaces.update(instance.instanceId, {
        placement: { host: 'dockview', mode: 'edge', edge: 'top' },
      });
      console.error('failed to restore native surface window:', error);
    });
  }
  bringSurfaceToFront(options.instanceId);
}

  function removeWindowRecord(windowId: string): void {
    appServices.surfaces.close(windowId);
  }


  function createTreeDataSnapshotSignature(
    model: TreeDataWindowModel,
    viewState: TreeDataWindowViewState,
  ): string {
    return JSON.stringify({
      title: model.title,
      description: model.description ?? null,
      rootId: model.root.id,
      root: model.root,
      selectedNodeId: viewState.selectedNodeId,
      expandedNodeIds: [...viewState.expandedNodeIds],
    });
  }

  function ensureTreeDataTransportSession(
    windowId: string,
    surfaceId: string,
  ): TreeDataWindowTransportSession {
    const session = treeDataTransportHub.ensureSession<TreeDataWindowCommand, TreeDataWindowSnapshot>(surfaceId, windowId);
    const currentUnlisten = treeDataTransportUnlisteners.get(windowId);

    if (!currentUnlisten || treeDataTransportHub.getSession<TreeDataWindowCommand, TreeDataWindowSnapshot>(windowId) !== session) {
      currentUnlisten?.();
      treeDataTransportUnlisteners.set(
        windowId,
        session.onCommand((envelope) => {
          logTreeTransport('command received', {
        windowId,
        surfaceId,
        revision: envelope.revision,
        command: envelope.payload,
      });
          worldSurfaceCommandRouter.dispatch(windowId, {
            type: envelope.payload.type,
            revision: envelope.revision,
            payload: envelope.payload as unknown as WorldSurfacePayload,
          });
        }),
      );
      worldSurfaceCommandRouter.register(windowId, (command) => {
        handleTreeDataTransportCommand(
          windowId,
          { type: command.type, ...(command.payload ?? {}) } as unknown as TreeDataWindowCommand,
          command.revision,
        );
      });
    }

    return session;
  }

  function clearTreeDataTransportSession(windowId: string): void {
    worldSurfaceSnapshotStore.dispose(windowId);
    worldSurfaceCommandRouter.dispose(windowId);
    treeDataSnapshotUnlisteners.get(windowId)?.();
    treeDataSnapshotUnlisteners.delete(windowId);
    treeDataSurfaceModelProviders.delete(windowId);
    treeDataSurfaceCommandHandlers.delete(windowId);
    treeDataSurfaceSourceTabs.delete(windowId);
    treeDataTransportSnapshotSignatures.delete(windowId);

    const unlisten = treeDataTransportUnlisteners.get(windowId);
    if (unlisten) {
      unlisten();
      treeDataTransportUnlisteners.delete(windowId);
    }

    treeDataTransportHub.deleteSession(windowId);
  }

  function rememberTreeDataTransportState(
    windowId: string,
    model: TreeDataWindowModel,
  ): void {
    const currentViewState = treeDataViewController.ensure(windowId, model.root.id);
    const session = treeDataTransportHub.getSession<TreeDataWindowCommand, TreeDataWindowSnapshot>(windowId);

    if (!session) {
      return;
    }

    logTreeTransport('snapshot publish requested', {
      windowId,
      modelTitle: model.title,
      rootChildCount: model.root.children?.length ?? 0,
      selectedNodeId: currentViewState.selectedNodeId,
      expandedNodeCount: currentViewState.expandedNodeIds.length,
    });
    publishTreeDataTransportSnapshot(windowId, session, model, currentViewState);
  }

  function isPoppedOutTreeWindow(windowRecord: WindowRecord | null): boolean {
    if (!windowRecord) {
      return false;
    }

    return isTreeDataSurfaceWindow(windowRecord) && windowRecord.placement === 'window';
  }

  function ensureTreeDataBridgeSession(
    windowId: string,
    surfaceId: string,
  ): TreeDataWindowTransportSession {
    const existing = treeDataBridgeSessions.get(windowId);
    if (existing && existing.surfaceId === surfaceId && !existing.isClosed()) {
      return existing;
    }

    existing?.close();
    const session = createTreeDataBridgeSession(surfaceId, windowId);
    treeDataBridgeSessions.set(windowId, session);
    logTreeTransport('bridge session created', {
      windowId,
      surfaceId,
    });
    return session;
  }

  function clearTreeDataBridgeSession(windowId: string): void {
    const session = treeDataBridgeSessions.get(windowId);
    if (session) {
      session.close();
      treeDataBridgeSessions.delete(windowId);
      logTreeTransport('bridge session cleared', {
        windowId,
      });
    }
    treeDataBridgeSnapshotSignatures.delete(windowId);
  }

  async function emitTreeDataBridgeSnapshot(
    windowId: string,
    snapshot: SurfaceEnvelopeBase<'surface.snapshot', TreeDataWindowSnapshot>,
  ): Promise<void> {
    if (!isPoppedOutWindow) {
      await emit(getTreeDataBridgeSnapshotEventName(windowId), snapshot);
    }
  }

  function createTreeDataWindowModelForSurface(windowId: string): TreeDataWindowModel | null {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (!windowRecord) {
      return null;
    }

    if (isTreeDataSurfaceWindow(windowRecord)) {
      return treeDataSurfaceModelProviders.get(windowId)?.() ?? createDemoTreeDataWindowModel();
    }

    return null;
  }

  function emitTreeDataBridgeSnapshotForWindow(
    windowId: string,
    windowRecord: WindowRecord,
    force = false,
  ): void {
    const model = createTreeDataWindowModelForSurface(windowId);
    if (!model) {
      return;
    }

    const currentViewState = treeDataViewController.ensure(windowId, model.root.id);
    const signature = createTreeDataSnapshotSignature(model, currentViewState);
    if (!force && treeDataBridgeSnapshotSignatures.get(windowId) === signature) {
      return;
    }

    treeDataBridgeSnapshotSignatures.set(windowId, signature);
    const snapshot: SurfaceEnvelopeBase<'surface.snapshot', TreeDataWindowSnapshot> = {
      surfaceId: windowRecord.surfaceId,
      instanceId: windowId,
      kind: 'surface.snapshot',
      source: 'host',
      revision: treeDataTransportHub.getSession<TreeDataWindowCommand, TreeDataWindowSnapshot>(windowId)?.getRevision() ?? 0,
      timestamp: Date.now(),
      payload: {
        model,
        viewState: currentViewState,
      },
    };

    logTreeTransport('bridge snapshot emit', {
      windowId,
      surfaceId: windowRecord.surfaceId,
      revision: snapshot.revision,
      selectedNodeId: currentViewState.selectedNodeId,
      expandedNodeCount: currentViewState.expandedNodeIds.length,
      force,
    });
    void emitTreeDataBridgeSnapshot(windowId, snapshot).catch((error) => {
      console.error('failed to emit tree data bridge snapshot:', error);
    });
  }

  function syncPoppedOutTreeDataSnapshots(
    _cacheVersion: number = treeDataInvalidationVersion,
    _poppedOutWindowIds: string = Object.keys(poppedOutWindowRecords).join('|'),
    _windowCount: number = getRegisteredWindowRecords().length,
  ): void {
    if (isPoppedOutWindow) {
      return;
    }

    for (const [windowId, windowRecord] of Object.entries(poppedOutWindowRecords)) {
      if (!isPoppedOutTreeWindow(windowRecord)) {
        continue;
      }

      emitTreeDataBridgeSnapshotForWindow(windowId, windowRecord);
    }
  }

  function publishTreeDataTransportSnapshot(
    windowId: string,
    session: TreeDataWindowTransportSession,
    model: TreeDataWindowModel,
    viewState: TreeDataWindowViewState,
  ): SurfaceEnvelopeBase<'surface.snapshot', TreeDataWindowSnapshot> | null {
    const signature = createTreeDataSnapshotSignature(model, viewState);
    if (treeDataTransportSnapshotSignatures.get(windowId) === signature) {
      logTreeTransport('snapshot skipped unchanged', {
        windowId,
        revision: session.getRevision(),
        selectedNodeId: viewState.selectedNodeId,
        expandedNodeCount: viewState.expandedNodeIds.length,
      });
      return session.getSnapshot();
    }

    treeDataTransportSnapshotSignatures.set(windowId, signature);
    logTreeTransport('snapshot publish', {
      windowId,
      revision: session.getRevision() + 1,
      rootChildCount: model.root.children?.length ?? 0,
      selectedNodeId: viewState.selectedNodeId,
      expandedNodeCount: viewState.expandedNodeIds.length,
    });
    const snapshot = session.publishSnapshot({
      model,
      viewState,
    });
    if (snapshot) {
      worldSurfaceSnapshotStore.publish({
        protocolVersion: WORLD_SURFACE_PROTOCOL_VERSION,
        surfaceId: snapshot.surfaceId,
        instanceId: snapshot.instanceId,
        revision: snapshot.revision,
        model: model as unknown as WorldSurfaceJsonValue,
        viewState: viewState as unknown as WorldSurfaceJsonValue,
      });
    }
    const windowRecord = poppedOutWindowRecords[windowId] ?? null;
    if (!isPoppedOutWindow && windowRecord && isPoppedOutTreeWindow(windowRecord) && snapshot) {
      treeDataBridgeSnapshotSignatures.set(windowId, signature);
      void emitTreeDataBridgeSnapshot(windowId, snapshot).catch((error) => {
        console.error('failed to emit tree data bridge snapshot:', error);
      });
    }

    return snapshot;
  }

  function ensureDebugConsoleTransportSession(
    windowId: string,
    surfaceId: string,
  ): DebugConsoleWindowTransportSession {
    const session = debugConsoleTransportHub.ensureSession<DebugConsoleWindowCommand, DebugConsoleWindowSnapshot>(surfaceId, windowId);
    const currentUnlisten = debugConsoleTransportUnlisteners.get(windowId);

    if (!currentUnlisten || debugConsoleTransportHub.getSession<DebugConsoleWindowCommand, DebugConsoleWindowSnapshot>(windowId) !== session) {
      currentUnlisten?.();
      debugConsoleTransportUnlisteners.set(
        windowId,
        session.onCommand((envelope) => {
          logDebugConsoleTransport('command received', {
            windowId,
            surfaceId,
            revision: envelope.revision,
            command: envelope.payload,
          });
          handleDebugConsoleTransportCommand(windowId, envelope.payload, envelope.revision);
        }),
      );
    }

    return session;
  }

  function clearDebugConsoleTransportSession(windowId: string): void {
    debugConsoleTransportSnapshotSignatures.delete(windowId);

    const unlisten = debugConsoleTransportUnlisteners.get(windowId);
    if (unlisten) {
      unlisten();
      debugConsoleTransportUnlisteners.delete(windowId);
    }

    debugConsoleTransportHub.deleteSession(windowId);
  }

  function ensureDebugConsoleBridgeSession(
    windowId: string,
    surfaceId: string,
  ): DebugConsoleBridgeSession {
    const existing = debugConsoleBridgeSessions.get(windowId);
    if (existing && existing.surfaceId === surfaceId && !existing.isClosed()) {
      return existing;
    }

    existing?.close();
    const bridgeSession = createDebugConsoleBridgeSession(surfaceId, windowId);
    debugConsoleBridgeSessions.set(windowId, bridgeSession);
    logDebugConsoleTransport('bridge session created', {
      windowId,
      surfaceId,
    });
    return bridgeSession;
  }

  function clearDebugConsoleBridgeSession(windowId: string): void {
    const bridgeSession = debugConsoleBridgeSessions.get(windowId);
    if (bridgeSession) {
      bridgeSession.close();
      debugConsoleBridgeSessions.delete(windowId);
      logDebugConsoleTransport('bridge session cleared', {
        windowId,
      });
    }

    debugConsoleBridgeSnapshotSignatures.delete(windowId);
  }

  async function emitDebugConsoleBridgeSnapshot(
    windowId: string,
    snapshot: SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot>,
  ): Promise<void> {
    if (!isPoppedOutWindow) {
      await emit(getDebugConsoleBridgeSnapshotEventName(windowId), snapshot);
    }
  }

  function createDebugConsoleWindowModelForSurface(windowId: string): DebugConsoleWindowSnapshot['model'] | null {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (!windowRecord || !isDebugConsoleWindow(windowRecord)) {
      return null;
    }

    const tabId = getDebugConsoleTabIdFromSurfaceId(windowRecord.surfaceId);
    if (!tabId) {
      return null;
    }

    const sourceState = getDebugConsoleWindowSourceState(tabId);

    return buildDebugConsoleWindowModel(
      sourceState,
      createDebugConsoleWindowTitle(tabId),
      createDebugConsoleWindowDescription(tabId),
    );
  }

  function emitDebugConsoleBridgeSnapshotForWindow(
    windowId: string,
    windowRecord: WindowRecord,
    force = false,
  ): void {
    const model = createDebugConsoleWindowModelForSurface(windowId);
    if (!model) {
      return;
    }

    const signature = JSON.stringify(model);
    if (!force && debugConsoleBridgeSnapshotSignatures.get(windowId) === signature) {
      return;
    }

    debugConsoleBridgeSnapshotSignatures.set(windowId, signature);
    const snapshot: SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot> = {
      surfaceId: windowRecord.surfaceId,
      instanceId: windowId,
      kind: 'surface.snapshot',
      source: 'host',
      revision: debugConsoleTransportHub.getSession<DebugConsoleWindowCommand, DebugConsoleWindowSnapshot>(windowId)?.getRevision() ?? 0,
      timestamp: Date.now(),
      payload: {
        model,
      },
    };

    logDebugConsoleTransport('bridge snapshot emit', {
      windowId,
      surfaceId: windowRecord.surfaceId,
      revision: snapshot.revision,
      entryCount: model.entries.length,
      force,
    });
    void emitDebugConsoleBridgeSnapshot(windowId, snapshot).catch((error) => {
      console.error('failed to emit debug console bridge snapshot:', error);
    });
  }

  function syncPoppedOutDebugConsoleSnapshots(
    _cacheVersion: number = debugConsoleCacheVersion,
    _poppedOutWindowIds: string = Object.keys(poppedOutWindowRecords).join('|'),
    _windowCount: number = getRegisteredWindowRecords().length,
  ): void {
    if (isPoppedOutWindow) {
      return;
    }

    for (const [windowId, windowRecord] of Object.entries(poppedOutWindowRecords)) {
      if (!isDebugConsoleWindow(windowRecord)) {
        continue;
      }

      emitDebugConsoleBridgeSnapshotForWindow(windowId, windowRecord);
    }
  }

  function publishDebugConsoleTransportSnapshot(
    windowId: string,
    session: DebugConsoleWindowTransportSession,
    model: DebugConsoleWindowSnapshot['model'],
  ): SurfaceEnvelopeBase<'surface.snapshot', DebugConsoleWindowSnapshot> | null {
    const signature = JSON.stringify(model);
    if (debugConsoleTransportSnapshotSignatures.get(windowId) === signature) {
      logDebugConsoleTransport('snapshot skipped unchanged', {
        windowId,
        revision: session.getRevision(),
        entryCount: model.entries.length,
      });
      return session.getSnapshot();
    }

    debugConsoleTransportSnapshotSignatures.set(windowId, signature);
    logDebugConsoleTransport('snapshot publish', {
      windowId,
      revision: session.getRevision() + 1,
      entryCount: model.entries.length,
    });
    const snapshot = session.publishSnapshot({
      model,
    });
    const windowRecord = poppedOutWindowRecords[windowId] ?? null;
    if (!isPoppedOutWindow && windowRecord && isDebugConsoleWindow(windowRecord) && snapshot) {
      debugConsoleBridgeSnapshotSignatures.set(windowId, signature);
      void emitDebugConsoleBridgeSnapshot(windowId, snapshot).catch((error) => {
        console.error('failed to emit debug console bridge snapshot:', error);
      });
    }

    return snapshot;
  }

  function ensureNotesTransportSession(windowId: string, surfaceId: string): NotesWindowTransportSession {
    const session = notesTransportHub.ensureSession<NotesWindowCommand, NotesWindowSnapshot>(surfaceId, windowId);
    const currentUnlisten = notesTransportUnlisteners.get(windowId);

    if (!currentUnlisten || notesTransportHub.getSession<NotesWindowCommand, NotesWindowSnapshot>(windowId) !== session) {
      currentUnlisten?.();
      notesTransportUnlisteners.set(
        windowId,
        session.onCommand((envelope) => {
          logNotesTransport('command received', {
            windowId,
            surfaceId,
            revision: envelope.revision,
            command: envelope.payload,
          });
          handleNotesTransportCommand(windowId, envelope.payload, envelope.revision);
        }),
      );
    }

    return session;
  }

  function clearNotesTransportSession(windowId: string): void {
    notesTransportSnapshotSignatures.delete(windowId);

    const unlisten = notesTransportUnlisteners.get(windowId);
    if (unlisten) {
      unlisten();
      notesTransportUnlisteners.delete(windowId);
    }

    notesTransportHub.deleteSession(windowId);
  }

  function ensureNotesBridgeSession(windowId: string, surfaceId: string): NotesBridgeSession {
    const existing = notesBridgeSessions.get(windowId);
    if (existing && existing.surfaceId === surfaceId && !existing.isClosed()) {
      return existing;
    }

    existing?.close();
    const bridgeSession = createNotesBridgeSession(surfaceId, windowId);
    notesBridgeSessions.set(windowId, bridgeSession);
    logNotesTransport('bridge session created', {
      windowId,
      surfaceId,
    });
    return bridgeSession;
  }

  function clearNotesBridgeSession(windowId: string): void {
    const bridgeSession = notesBridgeSessions.get(windowId);
    if (bridgeSession) {
      bridgeSession.close();
      notesBridgeSessions.delete(windowId);
      logNotesTransport('bridge session cleared', {
        windowId,
      });
    }

    notesBridgeSnapshotSignatures.delete(windowId);
  }

  async function emitNotesBridgeSnapshot(
    windowId: string,
    snapshot: SurfaceEnvelopeBase<'surface.snapshot', NotesWindowSnapshot>,
  ): Promise<void> {
    if (!isPoppedOutWindow) {
      await emit(getNotesBridgeSnapshotEventName(windowId), snapshot);
    }
  }

  function createNotesWindowModelForSurface(windowId: string): NotesWindowSnapshot['model'] | null {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (!windowRecord || !isNotesWindow(windowRecord)) {
      return null;
    }

    const tabId = getNotesTabIdFromSurfaceId(windowRecord.surfaceId);
    if (!tabId) {
      return null;
    }

    return buildNotesWindowModel(
      getNotesWindowSourceState(tabId),
      appServices.spellcheck.getConfig(),
    );
  }

  function emitNotesBridgeSnapshotForWindow(
    windowId: string,
    windowRecord: WindowRecord,
    force = false,
  ): void {
    const model = createNotesWindowModelForSurface(windowId);
    if (!model) {
      return;
    }

    const signature = JSON.stringify(model);
    if (!force && notesBridgeSnapshotSignatures.get(windowId) === signature) {
      return;
    }

    notesBridgeSnapshotSignatures.set(windowId, signature);
    const snapshot: SurfaceEnvelopeBase<'surface.snapshot', NotesWindowSnapshot> = {
      surfaceId: windowRecord.surfaceId,
      instanceId: windowId,
      kind: 'surface.snapshot',
      source: 'host',
      revision: notesTransportHub.getSession<NotesWindowCommand, NotesWindowSnapshot>(windowId)?.getRevision() ?? 0,
      timestamp: Date.now(),
      payload: {
        model,
      },
    };

    logNotesTransport('bridge snapshot emit', {
      windowId,
      surfaceId: windowRecord.surfaceId,
      revision: snapshot.revision,
      noteLength: model.notes.length,
      force,
    });
    void emitNotesBridgeSnapshot(windowId, snapshot).catch((error) => {
      console.error('failed to emit notes bridge snapshot:', error);
    });
  }

  function syncPoppedOutNotesSnapshots(
    _poppedOutWindowIds: string = Object.keys(poppedOutWindowRecords).join('|'),
    _windowCount: number = getRegisteredWindowRecords().length,
  ): void {
    if (isPoppedOutWindow) {
      return;
    }

    for (const [windowId, windowRecord] of Object.entries(poppedOutWindowRecords)) {
      if (!isNotesWindow(windowRecord)) {
        continue;
      }

      emitNotesBridgeSnapshotForWindow(windowId, windowRecord);
    }
  }

  function publishNotesTransportSnapshot(
    windowId: string,
    session: NotesWindowTransportSession,
    model: NotesWindowSnapshot['model'],
  ): SurfaceEnvelopeBase<'surface.snapshot', NotesWindowSnapshot> | null {
    const signature = JSON.stringify(model);
    if (notesTransportSnapshotSignatures.get(windowId) === signature) {
      logNotesTransport('snapshot skipped unchanged', {
        windowId,
        revision: session.getRevision(),
        noteLength: model.notes.length,
      });
      return session.getSnapshot();
    }

    notesTransportSnapshotSignatures.set(windowId, signature);
    logNotesTransport('snapshot publish', {
      windowId,
      revision: session.getRevision() + 1,
      noteLength: model.notes.length,
    });
    const snapshot = session.publishSnapshot({
      model,
    });
    const windowRecord = poppedOutWindowRecords[windowId] ?? null;
    if (!isPoppedOutWindow && windowRecord && isNotesWindow(windowRecord) && snapshot) {
      notesBridgeSnapshotSignatures.set(windowId, signature);
      void emitNotesBridgeSnapshot(windowId, snapshot).catch((error) => {
        console.error('failed to emit notes bridge snapshot:', error);
      });
    }

    return snapshot;
  }

  function handleNotesTransportCommand(
    windowId: string,
    command: NotesWindowCommand,
    expectedRevision?: number,
  ): void {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;
    if (!windowRecord || !isNotesWindow(windowRecord)) {
      return;
    }

    const tabId = getNotesTabIdFromSurfaceId(windowRecord.surfaceId);
    if (!tabId) {
      return;
    }

    const notesSession = notesTransportHub.getSession<NotesWindowCommand, NotesWindowSnapshot>(windowId);
    if (!notesSession) {
      return;
    }

    if (expectedRevision !== undefined && expectedRevision !== notesSession.getRevision()) {
      logNotesTransport('command ignored due to stale revision', {
        windowId,
        expectedRevision,
        currentRevision: notesSession.getRevision(),
        command,
      });
      return;
    }

    logNotesTransport('command handling', {
      windowId,
      command,
      revision: notesSession.getRevision(),
    });

    if (command.type === 'notesChanged') {
      session.saveNotes(tabId, command.notes);
      const model = createNotesWindowModelForSurface(windowId);
      if (model) {
        publishNotesTransportSnapshot(windowId, notesSession, model);
      }
      return;
    }

    if (command.type === 'ignoreWordRequested') {
      void appServices.spellcheck.ignoreWord(command.word);
      return;
    }

    if (command.type === 'closeRequested') {
      void closeNotesWindow(tabId);
    }
  }

  function handleTreeDataTransportCommand(
    windowId: string,
    command: TreeDataWindowCommand,
    expectedRevision?: number,
  ): void {
    const model = treeDataSurfaceModelProviders.get(windowId)?.() ?? createDemoTreeDataWindowModel();
    const treeSession = treeDataTransportHub.getSession<TreeDataWindowCommand, TreeDataWindowSnapshot>(windowId);

    if (!treeSession) {
      return;
    }

    if (expectedRevision !== undefined && expectedRevision !== treeSession.getRevision()) {
      logTreeTransport('command ignored due to stale revision', {
        windowId,
        expectedRevision,
        currentRevision: treeSession.getRevision(),
        command,
      });
      return;
    }

    logTreeTransport('command handling', {
      windowId,
      command,
      revision: treeSession.getRevision(),
    });
    const nextViewState = treeDataViewController.update(windowId, model, command);
    treeDataRefreshVersion += 1;
    logTreeTransport('command reduced', {
      windowId,
      nextSelectedNodeId: nextViewState.selectedNodeId,
      nextExpandedNodeCount: nextViewState.expandedNodeIds.length,
    });
    publishTreeDataTransportSnapshot(windowId, treeSession, model, nextViewState);

    treeDataSurfaceCommandHandlers.get(windowId)?.(command, model);
  }

  function handleDebugConsoleTransportCommand(
    windowId: string,
    command: DebugConsoleWindowCommand,
    expectedRevision?: number,
  ): void {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;
    if (!windowRecord || !isDebugConsoleWindow(windowRecord)) {
      return;
    }

    const tabId = getDebugConsoleTabIdFromSurfaceId(windowRecord.surfaceId);
    if (!tabId) {
      return;
    }

    const debugConsoleSession = debugConsoleTransportHub.getSession<DebugConsoleWindowCommand, DebugConsoleWindowSnapshot>(windowId);
    if (!debugConsoleSession) {
      return;
    }

    if (expectedRevision !== undefined && expectedRevision !== debugConsoleSession.getRevision()) {
      logDebugConsoleTransport('command ignored due to stale revision', {
        windowId,
        expectedRevision,
        currentRevision: debugConsoleSession.getRevision(),
        command,
      });
      return;
    }

    logDebugConsoleTransport('command handling', {
      windowId,
      command,
      revision: debugConsoleSession.getRevision(),
    });

    if (command.type === 'closeRequested') {
      void closeDebugConsoleWindow(tabId);
    }
  }

  function getTreeDataWindowRenderProps(
    windowId: string,
    _cacheVersion: number = treeDataInvalidationVersion,
  ): TreeDataWindowRenderProps | null {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (!windowRecord) {
      return null;
    }

    if (isPoppedOutWindow) {
      if (!isTreeDataSurfaceWindow(windowRecord)) {
        return null;
      }

      const session = ensureTreeDataBridgeSession(windowId, windowRecord.surfaceId);
      const placeholderModel = createTreeDataWindowPlaceholderModel(windowRecord.title);
      return {
        model: placeholderModel,
        viewState: treeDataViewController.ensure(windowId, placeholderModel.root.id),
        transportSession: session,
        onCommand: () => {},
      };
    }

    if (isTreeDataSurfaceWindow(windowRecord)) {
      const model = treeDataSurfaceModelProviders.get(windowId)?.() ?? createDemoTreeDataWindowModel();
      const session = ensureTreeDataTransportSession(windowId, windowRecord.surfaceId);
      rememberTreeDataTransportState(windowId, model);
      logTreeTransport('render props ready', {
        windowId,
        surfaceId: windowRecord.surfaceId,
        revision: session.getRevision(),
      });
      return {
        model,
        viewState: treeDataViewController.ensure(windowId, model.root.id),
        transportSession: session,
        onCommand: (command) => handleTreeDataTransportCommand(windowId, command),
      };
    }

    return null;
  }

  function getDebugConsoleWindowRenderProps(
    windowId: string,
    _cacheVersion: number = debugConsoleCacheVersion,
  ): DebugConsoleWindowRenderProps | null {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (!windowRecord || !isDebugConsoleWindow(windowRecord)) {
      return null;
    }

    const tabId = getDebugConsoleTabIdFromSurfaceId(windowRecord.surfaceId);
    if (!tabId) {
      return null;
    }

    if (isPoppedOutWindow) {
      const session = ensureDebugConsoleBridgeSession(windowId, windowRecord.surfaceId);
      return {
        model: createDebugConsoleWindowPlaceholderModel(windowRecord.title),
        transportSession: session,
        onCommand: () => {},
      };
    }

    const model = createDebugConsoleWindowModelForSurface(windowId)
      ?? createDebugConsoleWindowPlaceholderModel(windowRecord.title);
    const session = ensureDebugConsoleTransportSession(windowId, windowRecord.surfaceId);
    publishDebugConsoleTransportSnapshot(windowId, session, model);
    return {
      model,
      transportSession: session,
      onCommand: (command) => handleDebugConsoleTransportCommand(windowId, command),
    };
  }

  function getDebugConsoleDockviewPanel(tabId: string, _surfaceRegistryVersion = 0): DockviewDebugConsolePanelDefinition | null {
    const windowId = getDebugConsoleWindowId(tabId);
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId) ?? null;
    const surfaceInstance = appServices.surfaces.getInstance(windowId);

    if (!windowRecord || windowRecord.placement !== 'in-app' || !isDebugConsoleWindow(windowRecord) || !surfaceInstance) {
      return null;
    }

    const model = createDebugConsoleWindowModelForSurface(windowId);
    if (!model) {
      return null;
    }

    return {
      kind: 'debug-console',
      instanceId: windowId,
      title: getDockviewSurfaceTitle(windowRecord),
      model,
      onCommand: (command) => handleDebugConsoleTransportCommand(windowId, command),
      getPreviousDockedEdge: () => appServices.surfaces.getInstance(windowId)?.previousDockedEdge,
      onClose: () => void closeDebugConsoleWindow(tabId),
      onPopOutNative: () => void handlePopOutWindow(windowId),
      onPlacementChange: (placement, edge) => {
        appServices.surfaces.update(windowId, {
          placement: placement === 'floating'
            ? { host: 'dockview', mode: 'floating' }
            : placement === 'edge'
              ? { host: 'dockview', mode: 'edge', edge: edge ?? 'top' }
              : { host: 'dockview', mode: 'grid' },
        });
      },
      onBoundsChange: (position, size) => appServices.surfaces.update(windowId, { position, size }),
      initialPlacement: getDockviewPlacementMode(windowId),
      position: surfaceInstance.position,
      size: surfaceInstance.size,
    };
  }

  function getNotesDockviewPanel(tabId: string, _surfaceRegistryVersion = 0): DockviewNotesPanelDefinition | null {
    const windowId = getNotesWindowId(tabId);
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId) ?? null;
    const surfaceInstance = appServices.surfaces.getInstance(windowId);

    if (!windowRecord || windowRecord.placement !== 'in-app' || !isNotesWindow(windowRecord) || !surfaceInstance) {
      return null;
    }

    const model = createNotesWindowModelForSurface(windowId);
    if (!model) {
      return null;
    }

    return {
      kind: 'notes',
      instanceId: windowId,
      title: getDockviewSurfaceTitle(windowRecord),
      model,
      onCommand: (command) => handleNotesTransportCommand(windowId, command),
      getPreviousDockedEdge: () => appServices.surfaces.getInstance(windowId)?.previousDockedEdge,
      onClose: () => void closeNotesWindow(tabId),
      onPopOutNative: () => void handlePopOutWindow(windowId),
      onPlacementChange: (placement, edge) => {
        appServices.surfaces.update(windowId, {
          placement: placement === 'floating'
            ? { host: 'dockview', mode: 'floating' }
            : placement === 'edge'
              ? { host: 'dockview', mode: 'edge', edge: edge ?? 'top' }
              : { host: 'dockview', mode: 'grid' },
        });
      },
      onBoundsChange: (position, size) => appServices.surfaces.update(windowId, { position, size }),
      initialPlacement: getDockviewPlacementMode(windowId),
      position: surfaceInstance.position,
      size: surfaceInstance.size,
    };
  }

  function getTreeDataDockviewPanels(
    sourceTabId: string,
    isHostTab: boolean,
    _surfaceRegistryVersion = 0,
    _treeDataRefreshVersion = treeDataRefreshVersion,
  ): DockviewTreeDataPanelDefinition[] {
    return getRegisteredWindowRecords()
      .filter((windowRecord) => isTreeDataSurfaceWindow(windowRecord))
      .filter((windowRecord) => windowRecord.placement === 'in-app')
      .filter((windowRecord) => {
        const sourceTab = treeDataSurfaceSourceTabs.get(windowRecord.id);
        return sourceTab ? sourceTab === sourceTabId : isHostTab && windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.treeDataDemo;
      })
      .flatMap((windowRecord) => {
        const surfaceInstance = appServices.surfaces.getInstance(windowRecord.id);
        if (!surfaceInstance) {
          return [];
        }

        const model = treeDataSurfaceModelProviders.get(windowRecord.id)?.() ?? createDemoTreeDataWindowModel();
        const viewState = treeDataViewController.ensure(windowRecord.id, model.root.id);
        rememberTreeDataTransportState(windowRecord.id, model);

        return [{
          kind: 'tree-data' as const,
          instanceId: windowRecord.id,
          title: getDockviewSurfaceTitle(windowRecord),
          model,
          viewState,
          onCommand: (command: TreeDataWindowCommand) => handleTreeDataTransportCommand(windowRecord.id, command),
          getPreviousDockedEdge: () => appServices.surfaces.getInstance(windowRecord.id)?.previousDockedEdge,
          onClose: () => void closeTreeDataSurfaceWindow(windowRecord.id),
          onPopOutNative: () => void handlePopOutWindow(windowRecord.id),
          onPlacementChange: (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => {
            appServices.surfaces.update(windowRecord.id, {
              placement: placement === 'floating'
                ? { host: 'dockview', mode: 'floating' }
                : placement === 'edge'
                  ? { host: 'dockview', mode: 'edge', edge: edge ?? 'top' }
                  : { host: 'dockview', mode: 'grid' },
            });
          },
          onBoundsChange: (position, size) => appServices.surfaces.update(windowRecord.id, { position, size }),
          initialPlacement: getDockviewPlacementMode(windowRecord.id),
          position: appServices.surfaces.getInstance(windowRecord.id)?.position,
          size: appServices.surfaces.getInstance(windowRecord.id)?.size,
        }];
      });
  }

  function getDummyDockviewPanels(isHostTab: boolean, _surfaceRegistryVersion = 0): DockviewDummyWindowPanelDefinition[] {
    if (!isHostTab) {
      return [];
    }

    return getRegisteredWindowRecords()
      .filter((windowRecord) => windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.dummyWindow)
      .filter((windowRecord) => windowRecord.placement === 'in-app')
      .map((windowRecord) => ({
        kind: 'dummy-window' as const,
        instanceId: windowRecord.id,
        title: getDockviewSurfaceTitle(windowRecord),
        eyebrow: 'developer surface',
        description: 'Static placeholder content for the hosted window test.',
        tone: 'muted' as const,
        getPreviousDockedEdge: () => appServices.surfaces.getInstance(windowRecord.id)?.previousDockedEdge,
        onClose: () => void closeDummyWindow(windowRecord.id),
        onPopOutNative: () => void handlePopOutWindow(windowRecord.id),
        onPlacementChange: (placement: DockviewPanelPlacement, edge?: SurfaceEdge) => {
          appServices.surfaces.update(windowRecord.id, {
            placement: placement === 'floating'
              ? { host: 'dockview', mode: 'floating' }
              : placement === 'edge'
                ? { host: 'dockview', mode: 'edge', edge: edge ?? 'top' }
                : { host: 'dockview', mode: 'grid' },
          });
        },
        onBoundsChange: (position, size) => appServices.surfaces.update(windowRecord.id, { position, size }),
        initialPlacement: getDockviewPlacementMode(windowRecord.id),
        position: appServices.surfaces.getInstance(windowRecord.id)?.position,
        size: appServices.surfaces.getInstance(windowRecord.id)?.size,
      }));
  }

  function getNotesWindowRenderProps(
    windowId: string,
  ): NotesWindowRenderProps | null {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (!windowRecord || !isNotesWindow(windowRecord)) {
      return null;
    }

    const tabId = getNotesTabIdFromSurfaceId(windowRecord.surfaceId);
    if (!tabId) {
      return null;
    }

    if (isPoppedOutWindow) {
      const session = ensureNotesBridgeSession(windowId, windowRecord.surfaceId);
      return {
        model: createNotesWindowPlaceholderModel(windowRecord.title),
        transportSession: session,
        onCommand: () => {},
      };
    }

    const model = createNotesWindowModelForSurface(windowId)
      ?? createNotesWindowPlaceholderModel(windowRecord.title);
    const session = ensureNotesTransportSession(windowId, windowRecord.surfaceId);
    publishNotesTransportSnapshot(windowId, session, model);
    return {
      model,
      transportSession: session,
      onCommand: (command) => handleNotesTransportCommand(windowId, command),
    };
  }

  function ensureDummySurfaceRegistration(): string {
    const surfaceId = WINDOW_HOST_SINGLETON_IDS.dummyWindow;
    if (!appServices.surfaces.getRegistration(surfaceId)) {
      appServices.surfaces.register({
        surfaceId,
        kind: 'builtin',
        defaultTitle: 'dummy window',
        capabilities: {
          canClose: true,
          canDock: true,
          canFloat: true,
          canPopOut: true,
          canPopIn: true,
          isModal: false,
          allowsMultipleInstances: true,
        },
      });
    }

    return surfaceId;
  }

  function openDummyWindow(): void {
    const surfaceId = ensureDummySurfaceRegistration();
    const index = getRegisteredWindowRecords().length;
    const id = `dummy-window-${nextWindowHostId++}`;
    const model = createDemoTreeDataWindowModel();

    treeDataViewController.ensure(id, model.root.id);

    openSurfaceAndBringToFront({
      instanceId: id,
      surfaceId,
      title: `dummy window ${index + 1}`,
      placement: { host: 'dockview', mode: 'edge', edge: 'top' },
      position: { x: 120 + index * 28, y: 120 + index * 28 },
      size: { width: 560, height: 360 },
    });

  }

  function ensureTreeDataSurfaceRegistration(): string {
    const surfaceId = WINDOW_HOST_SINGLETON_IDS.treeDataDemo;
    if (!appServices.surfaces.getRegistration(surfaceId)) {
      appServices.surfaces.register({
        surfaceId,
        kind: 'builtin',
        defaultTitle: 'tree data viewer',
        capabilities: {
          canClose: true,
          canDock: true,
          canFloat: true,
          canPopOut: true,
          canPopIn: true,
          isModal: false,
          allowsMultipleInstances: true,
        },
      });
    }

    return surfaceId;
  }

  function openTreeDataWindow(): void {
    const surfaceId = ensureTreeDataSurfaceRegistration();
    const index = getRegisteredWindowRecords().length;
    const id = `tree-data-window-${nextWindowHostId++}`;
    const model = createDemoTreeDataWindowModel();
    registerTreeSurfaceInstance(id, () => model, () => {});

    treeDataViewController.ensure(id, model.root.id);
    ensureTreeDataTransportSession(id, WINDOW_HOST_SINGLETON_IDS.treeDataDemo);
    rememberTreeDataTransportState(id, model);
    logTreeTransport('open tree window', {
      windowId: id,
      surfaceId: WINDOW_HOST_SINGLETON_IDS.treeDataDemo,
      kind: 'demo',
    });

    openSurfaceAndBringToFront({
      instanceId: id,
      surfaceId,
      title: `tree data window ${index + 1}`,
      placement: { host: 'dockview', mode: 'edge', edge: 'top' },
      position: { x: 120 + index * 28, y: 120 + index * 28 },
      size: { width: 720, height: 560 },
    });

  }

  const pluginTreeDataSurfaceController = createFuzzballSurfaceHostAdapter({
    listWindows: () => getRegisteredWindowRecords(),
    isSurfaceWindow: (window) => isTreeDataSurfaceWindow(window as WindowRecord),
    activateWindow: (windowId) => appServices.surfaces.update(windowId, { isActive: true }),
    focusWindow: requestSurfaceFocus,
    getPluginService: (sourceTabId, key) => session.getWorldPluginService(sourceTabId, key),
    getSurfaceContribution: (sourceTabId, surfaceId) => session.getWorldPluginSurfaces(sourceTabId)
      .find((entry) => entry.id === surfaceId) ?? null,
    registerSurface: (registration) => {
      if (!appServices.surfaces.getRegistration(registration.surfaceId)) {
        appServices.surfaces.register(registration);
      }
    },
    registerOpenHandler: (pluginId, surfaceId, handler) => {
      worldPluginSurfaceOpenHandlers.set(`${pluginId}:${surfaceId}`, handler);
    },
    registerStateDisposer: (surfaceId, disposer) => {
      worldPluginSurfaceStateDisposers.set(surfaceId, disposer);
    },
    registerRestoreHandler: (surfaceId, handler) => {
      worldPluginSurfaceRestoreHandlers.set(surfaceId, handler);
    },
    registerSourceWindowProvider: (surfaceId, provider) => {
      worldPluginSurfaceSourceWindowProviders.set(surfaceId, provider);
    },
    getWorldContext: (tabId) => {
      const worldSession = $session.worldSessions[tabId];
      if (!worldSession?.currentWorld) {
        return null;
      }
      return {
        worldId: worldSession.currentWorld.id,
        characterId: worldSession.currentCharacter?.id ?? '',
        defaultTitle: `${worldSession.currentWorld.name} storage`,
      };
    },
    ensureTransport: ensureTreeDataTransportSession,
    rememberTransportModel: rememberTreeDataTransportState,
    registerTreeSurfaceInstance,
    disposeTreeSurfaceInstance: (windowId) => {
      treeDataSurfaceModelProviders.delete(windowId);
      treeDataSurfaceCommandHandlers.delete(windowId);
      treeDataSurfaceSourceTabs.delete(windowId);
    },
    log: logTreeTransport,
    openSurface: ({ instanceId, surfaceId, title, position, size }) => openSurfaceAndBringToFront({
      instanceId,
      surfaceId,
      title,
      placement: { host: 'dockview', mode: 'floating' },
      position,
      size,
    }),
  });

  function registerTreeSurfaceInstance(
    windowId: string,
    modelProvider: () => TreeDataWindowModel,
    commandHandler: (command: TreeDataWindowCommand, model: TreeDataWindowModel) => void,
    sourceTabId?: string,
  ): void {
    treeDataSnapshotUnlisteners.get(windowId)?.();
    treeDataSurfaceModelProviders.set(windowId, modelProvider);
    treeDataSurfaceCommandHandlers.set(windowId, commandHandler);
    if (sourceTabId) {
      treeDataSurfaceSourceTabs.set(windowId, sourceTabId);
    } else {
      treeDataSurfaceSourceTabs.delete(windowId);
    }
    treeDataSnapshotUnlisteners.set(
      windowId,
      worldSurfaceSnapshotStore.subscribe(windowId, (snapshot) => {
        treeDataRefreshVersion += 1;
        logTreeTransport('generic surface snapshot invalidated', {
          windowId,
          surfaceId: snapshot.surfaceId,
          revision: snapshot.revision,
        });
      }),
    );
  }

  function ensureDebugConsoleSurfaceRegistration(tabId: string): string {
    const surfaceId = getDebugConsoleSurfaceId(tabId);
    if (!appServices.surfaces.getRegistration(surfaceId)) {
      appServices.surfaces.register({
        surfaceId,
        kind: 'builtin',
        defaultTitle: 'debug console',
        capabilities: {
          canClose: true,
          canDock: true,
          canFloat: true,
          canPopOut: true,
          canPopIn: true,
          isModal: false,
          allowsMultipleInstances: false,
        },
      });
    }

    return surfaceId;
  }

  function openDebugConsoleWindow(tabId: string): void {
    const windowId = getDebugConsoleWindowId(tabId);
    const surfaceId = ensureDebugConsoleSurfaceRegistration(tabId);
    const existingWindowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (existingWindowRecord) {
      bringSurfaceToFront(windowId);

      if (!appServices.surfaces.getInstance(windowId)) {
        openSurfaceAndBringToFront({
          instanceId: windowId,
          surfaceId,
          title: existingWindowRecord.title,
          placement: existingWindowRecord.placement === 'window'
            ? { host: 'native', windowId }
            : { host: 'dockview', mode: 'edge', edge: 'top' },
        });
      }

      return;
    }

    const worldSession = $session.worldSessions[tabId] ?? null;
    if (worldSession?.currentWorld) {
      const sourceKey = createWorldSessionKey(worldSession.currentWorld.id, worldSession.currentCharacter?.id ?? null);
      const debugConsole = session.worldSessionContainers.debugConsole.ensure(sourceKey);
      debugConsole.sourceLabel = worldSession.currentCharacter
        ? `${worldSession.currentWorld.name} · ${worldSession.currentCharacter.name}`
        : worldSession.currentWorld.name;
    }

    const index = getRegisteredWindowRecords().length;
    const windowRecord = createWindowRecord({
      id: windowId,
      kind: 'builtin',
      surfaceId,
      title: createDebugConsoleWindowTitle(tabId),
      isModal: false,
      placement: 'in-app',
      sizeToContent: false,
      size: {
        width: 720,
        height: 560,
      },
      position: {
        x: 120 + index * 28,
        y: 120 + index * 28,
      },
      canBackdropDismiss: false,
      canEscapeDismiss: false,
      canPopOut: true,
      canMoveInApp: true,
    });

    const sessionModel = buildDebugConsoleWindowModel(
      getDebugConsoleWindowSourceState(tabId),
      createDebugConsoleWindowTitle(tabId),
      createDebugConsoleWindowDescription(tabId),
    );

    const transportSession = ensureDebugConsoleTransportSession(windowId, surfaceId);
    publishDebugConsoleTransportSnapshot(windowId, transportSession, sessionModel);

    openSurfaceAndBringToFront({
      instanceId: windowId,
      surfaceId,
      title: windowRecord.title,
      placement: { host: 'dockview', mode: 'edge', edge: 'top' },
      position: windowRecord.position,
      size: windowRecord.size,
    });

    logDebugConsoleTransport('open debug console window', {
      windowId,
      surfaceId,
      tabId,
    });
  }

  function ensureNotesSurfaceRegistration(tabId: string): string {
    const surfaceId = getNotesSurfaceId(tabId);
    if (!appServices.surfaces.getRegistration(surfaceId)) {
      appServices.surfaces.register({
        surfaceId,
        kind: 'builtin',
        defaultTitle: 'notes',
        capabilities: {
          canClose: true,
          canDock: true,
          canFloat: true,
          canPopOut: true,
          canPopIn: true,
          isModal: false,
          allowsMultipleInstances: false,
        },
      });
    }

    return surfaceId;
  }

  function openNotesWindow(tabId: string): void {
    const windowId = getNotesWindowId(tabId);
    const surfaceId = ensureNotesSurfaceRegistration(tabId);
    const existingWindowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (existingWindowRecord) {
      bringSurfaceToFront(windowId);
      if (!appServices.surfaces.getInstance(windowId)) {
        openSurfaceAndBringToFront({
          instanceId: windowId,
          surfaceId,
          title: existingWindowRecord.title,
          placement: existingWindowRecord.placement === 'window'
            ? { host: 'native', windowId }
            : { host: 'dockview', mode: 'edge', edge: 'top' },
        });
      }

      return;
    }

    const index = getRegisteredWindowRecords().length;
    const windowRecord = createWindowRecord({
      id: windowId,
      kind: 'builtin',
      surfaceId,
      title: createNotesWindowTitle(tabId),
      isModal: false,
      placement: 'in-app',
      sizeToContent: false,
      size: {
        width: 760,
        height: 640,
      },
      position: {
        x: 120 + index * 28,
        y: 120 + index * 28,
      },
      canBackdropDismiss: false,
      canEscapeDismiss: false,
      canPopOut: true,
      canMoveInApp: true,
    });

    const sessionModel = buildNotesWindowModel(
      getNotesWindowSourceState(tabId),
      appServices.spellcheck.getConfig(),
    );

    const transportSession = ensureNotesTransportSession(windowId, surfaceId);
    publishNotesTransportSnapshot(windowId, transportSession, sessionModel);

    openSurfaceAndBringToFront({
      instanceId: windowId,
      surfaceId,
      title: windowRecord.title,
      placement: { host: 'dockview', mode: 'edge', edge: 'top' },
      position: windowRecord.position,
      size: windowRecord.size,
    });

    logNotesTransport('open notes window', {
      windowId,
      surfaceId,
      tabId,
    });
  }

  async function closeDebugConsoleWindow(tabId: string): Promise<void> {
    const windowId = getDebugConsoleWindowId(tabId);
    const poppedOutWindowRecord = poppedOutWindowRecords[windowId] ?? null;
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId) ?? poppedOutWindowRecord;

    if (!windowRecord) {
      clearDebugConsoleTransportSession(windowId);
      clearDebugConsoleBridgeSession(windowId);
      appServices.surfaces.close(windowId);
      return;
    }

    closeWindow(windowId);
    appServices.surfaces.close(windowId);

    if (!poppedOutWindowRecord) {
      return;
    }

    removePoppedOutWindowRecord(windowId);
    await invoke('window_host_discard', { windowId }).catch((error) => {
      console.error('failed to discard debug console window:', error);
    });
  }

  async function closeNotesWindow(tabId: string): Promise<void> {
    const windowId = getNotesWindowId(tabId);
    const poppedOutWindowRecord = poppedOutWindowRecords[windowId] ?? null;
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId) ?? poppedOutWindowRecord;

    flushPendingNotesSave(tabId);

    if (!windowRecord) {
      clearNotesTransportSession(windowId);
      clearNotesBridgeSession(windowId);
      appServices.surfaces.close(windowId);
      return;
    }

    closeWindow(windowId);
    appServices.surfaces.close(windowId);

    if (!poppedOutWindowRecord) {
      return;
    }

    removePoppedOutWindowRecord(windowId);
    await invoke('window_host_discard', { windowId }).catch((error) => {
      console.error('failed to discard notes window:', error);
    });
  }

  function openOrFocusDebugConsoleWindow(tabId: string): void {
    const windowId = getDebugConsoleWindowId(tabId);
    const existingWindowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (existingWindowRecord) {
      appServices.surfaces.update(windowId, { isActive: true });
      requestSurfaceFocus(windowId);
      return;
    }

    openDebugConsoleWindow(tabId);
  }

  function openOrFocusNotesWindow(tabId: string): void {
    const windowId = getNotesWindowId(tabId);
    const existingWindowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (existingWindowRecord) {
      appServices.surfaces.update(windowId, { isActive: true });
      requestSurfaceFocus(windowId);
      return;
    }

    openNotesWindow(tabId);
  }

  async function closeTreeDataSurfaceWindow(windowId: string): Promise<void> {
    const poppedOutWindowRecord = poppedOutWindowRecords[windowId] ?? null;
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId) ?? poppedOutWindowRecord;

    if (!windowRecord || !isTreeDataSurfaceWindow(windowRecord)) {
      clearTreeDataTransportSession(windowId);
      clearTreeDataBridgeSession(windowId);
      disposePluginSurfaceState(windowId);
      appServices.surfaces.close(windowId);
      return;
    }

    closeWindow(windowId);
    appServices.surfaces.close(windowId);

    if (!poppedOutWindowRecord) {
      return;
    }

    removePoppedOutWindowRecord(windowId);
    await invoke('window_host_discard', { windowId }).catch((error) => {
      console.error('failed to discard tree-data surface window:', error);
    });
  }

  async function closeTreeDataWindow(windowId: string): Promise<void> {
    const poppedOutWindowRecord = poppedOutWindowRecords[windowId] ?? null;
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId) ?? poppedOutWindowRecord;

    if (!windowRecord || windowRecord.surfaceId !== WINDOW_HOST_SINGLETON_IDS.treeDataDemo) {
      clearTreeDataTransportSession(windowId);
      clearTreeDataBridgeSession(windowId);
      treeDataViewController.clear(windowId);
      appServices.surfaces.close(windowId);
      return;
    }

    closeWindow(windowId);
    appServices.surfaces.close(windowId);

    if (!poppedOutWindowRecord) {
      return;
    }

    removePoppedOutWindowRecord(windowId);
    await invoke('window_host_discard', { windowId }).catch((error) => {
      console.error('failed to discard tree data window:', error);
    });
  }

  async function closeDummyWindow(windowId: string): Promise<void> {
    const poppedOutWindowRecord = poppedOutWindowRecords[windowId] ?? null;
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId) ?? poppedOutWindowRecord;

    if (!windowRecord || windowRecord.surfaceId !== WINDOW_HOST_SINGLETON_IDS.dummyWindow) {
      appServices.surfaces.close(windowId);
      return;
    }

    closeWindow(windowId);
    appServices.surfaces.close(windowId);

    if (!poppedOutWindowRecord) {
      return;
    }

    removePoppedOutWindowRecord(windowId);
    await invoke('window_host_discard', { windowId }).catch((error) => {
      console.error('failed to discard dummy window:', error);
    });
  }

  function disposePluginSurfaceState(windowId: string, surfaceId?: string): void {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;
    worldPluginSurfaceStateDisposers.get(surfaceId ?? windowRecord?.surfaceId)?.(windowId);
  }

  async function discardPoppedOutWindowRecords(
    windowIds: readonly string[],
    surfaceLabel: string,
  ): Promise<void> {
    const windowIdSet = new Set(windowIds);
    const poppedOutWindowIds = windowIds.filter((windowId) => windowId in poppedOutWindowRecords);
    poppedOutWindowRecords = Object.fromEntries(
      Object.entries(poppedOutWindowRecords).filter(([windowId]) => !windowIdSet.has(windowId)),
    );

    await Promise.all(
      poppedOutWindowIds.map((windowId) =>
        invoke('window_host_discard', { windowId }).catch((error) => {
          console.error(`failed to discard ${surfaceLabel} window:`, error);
        }),
      ),
    );
  }

  async function discardPluginSurfaceWindowsForSourceTab(sourceTabId: string): Promise<void> {
    const matchedWindowIds = [...new Set(
      [...worldPluginSurfaceSourceWindowProviders.values()]
        .flatMap((getWindowIds) => getWindowIds(sourceTabId)),
    )];

    if (matchedWindowIds.length === 0) {
      return;
    }

    for (const windowId of matchedWindowIds) {
      const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId)
        ?? poppedOutWindowRecords[windowId]
        ?? null;
      disposePluginSurfaceState(windowId, windowRecord?.surfaceId);
      clearTreeDataTransportSession(windowId);
      clearTreeDataBridgeSession(windowId);
      treeDataViewController.clear(windowId);
      appServices.surfaces.close(windowId);
    }
    await discardPoppedOutWindowRecords(matchedWindowIds, 'tree-data surface');
  }

  async function discardTreeDataWindows(): Promise<void> {
    const matchedWindowIds = getRegisteredWindowRecords()
      .filter((windowRecord) =>
        windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.treeDataDemo
        || windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.dummyWindow,
      )
      .map((windowRecord) => windowRecord.id);

    if (matchedWindowIds.length === 0) {
      return;
    }

    for (const windowId of matchedWindowIds) {
      clearTreeDataTransportSession(windowId);
      clearTreeDataBridgeSession(windowId);
      treeDataViewController.clear(windowId);
      appServices.surfaces.close(windowId);
    }

    await discardPoppedOutWindowRecords(matchedWindowIds, 'tree-data');
  }

  async function discardDebugConsoleWindowsForSourceTab(sourceTabId: string): Promise<void> {
    const matchedWindowIds = getRegisteredWindowRecords()
      .filter((windowRecord) => isDebugConsoleWindow(windowRecord) && getDebugConsoleTabIdFromSurfaceId(windowRecord.surfaceId) === sourceTabId)
      .map((windowRecord) => windowRecord.id);

    if (matchedWindowIds.length === 0) {
      return;
    }

    for (const windowId of matchedWindowIds) {
      clearDebugConsoleTransportSession(windowId);
      clearDebugConsoleBridgeSession(windowId);
      appServices.surfaces.close(windowId);
    }

    await discardPoppedOutWindowRecords(matchedWindowIds, 'debug console');
  }

  async function discardNotesWindowsForSourceTab(sourceTabId: string): Promise<void> {
    const matchedWindowIds = getRegisteredWindowRecords()
      .filter((windowRecord) => isNotesWindow(windowRecord) && getNotesTabIdFromSurfaceId(windowRecord.surfaceId) === sourceTabId)
      .map((windowRecord) => windowRecord.id);

    if (matchedWindowIds.length === 0) {
      return;
    }

    for (const windowId of matchedWindowIds) {
      clearNotesTransportSession(windowId);
      clearNotesBridgeSession(windowId);
      appServices.surfaces.close(windowId);
    }

    await discardPoppedOutWindowRecords(matchedWindowIds, 'notes');
  }

  function closeWindow(windowId: string): void {
    logTreeTransport('close tree window', {
      windowId,
      hasTransportSession: treeDataTransportHub.getSession<TreeDataWindowCommand, TreeDataWindowSnapshot>(windowId) !== null,
    });
    clearTreeDataTransportSession(windowId);
    clearTreeDataBridgeSession(windowId);
    treeDataViewController.clear(windowId);
    disposePluginSurfaceState(windowId);
    clearDebugConsoleTransportSession(windowId);
    clearDebugConsoleBridgeSession(windowId);
    clearNotesTransportSession(windowId);
    clearNotesBridgeSession(windowId);

    removeWindowRecord(windowId);
  }

  function storePoppedOutWindowRecord(windowRecord: WindowRecord): void {
    poppedOutWindowRecords = {
      ...poppedOutWindowRecords,
      [windowRecord.id]: windowRecord,
    };
  }

  function removePoppedOutWindowRecord(windowId: string): WindowRecord | null {
    const windowRecord = poppedOutWindowRecords[windowId] ?? null;
    if (!windowRecord) {
      return null;
    }

    const { [windowId]: _removed, ...rest } = poppedOutWindowRecords;
    poppedOutWindowRecords = rest;
    return windowRecord;
  }

  function handlePoppedOutWindowReturned(returnedRecord: WindowRecord): void {
    const windowId = returnedRecord.id;
    const windowRecord = removePoppedOutWindowRecord(windowId);
    const recoveredWindowRecord = windowRecord ?? returnedRecord;

    console.log('[window-action] popped-out window returned to host', {
      windowId,
      title: recoveredWindowRecord.title,
      recovered: windowRecord === null,
    });

    if (!windowRecord) {
      worldPluginSurfaceRestoreHandlers.get(recoveredWindowRecord.surfaceId)?.(
        windowId,
        recoveredWindowRecord.title,
      );
    }

    if (!appServices.surfaces.getInstance(windowId)) {
      const registration = appServices.surfaces.getRegistration(recoveredWindowRecord.surfaceId);
      if (registration) {
        appServices.surfaces.open({
          instanceId: windowId,
          surfaceId: recoveredWindowRecord.surfaceId,
          title: recoveredWindowRecord.title,
          placement: { host: 'dockview', mode: 'edge', edge: 'top' },
          position: recoveredWindowRecord.position,
          size: recoveredWindowRecord.size,
          preferProvidedPlacement: true,
        });
      }
    }

    if (isDebugConsoleWindow(recoveredWindowRecord) || isNotesWindow(recoveredWindowRecord) || isTreeDataSurfaceWindow(recoveredWindowRecord)
      || recoveredWindowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.dummyWindow
      || worldPluginSurfaceRestoreHandlers.has(recoveredWindowRecord.surfaceId)) {
      appServices.surfaces.update(windowId, {
        placement: { host: 'dockview', mode: 'edge', edge: 'top' },
        position: returnedRecord.position,
        size: returnedRecord.size,
      });
    }
    clearTreeDataBridgeSession(windowId);
    clearDebugConsoleBridgeSession(windowId);
    clearNotesBridgeSession(windowId);
  }

  function handlePoppedOutWindowDiscarded(discardedRecord: WindowRecord): void {
    const windowId = discardedRecord.id;
    const windowRecord = removePoppedOutWindowRecord(windowId);
    if (!windowRecord) {
      console.log('[window-action] popped-out window discard ignored', {
        windowId,
      });
      return;
    }

    console.log('[window-action] popped-out window discarded', {
      windowId,
      title: windowRecord.title,
    });

    appServices.surfaces.update(windowId, {
      position: discardedRecord.position,
      size: discardedRecord.size,
    });

    clearTreeDataBridgeSession(windowId);
    treeDataViewController.clear(windowId);
    disposePluginSurfaceState(windowId, windowRecord.surfaceId);
    clearDebugConsoleBridgeSession(windowId);
    clearDebugConsoleTransportSession(windowId);
    appServices.surfaces.close(windowId);
    clearNotesBridgeSession(windowId);
    clearNotesTransportSession(windowId);
  }

  async function handlePopOutWindow(windowId: string): Promise<void> {
    const windowRecord = getRegisteredWindowRecords().find((record) => record.id === windowId);
    if (!windowRecord || !windowRecord.canPopOut || windowRecord.placement !== 'in-app') {
      return;
    }

    const nextWindowRecord: WindowRecord = {
      ...windowRecord,
      placement: 'window',
    };

    try {
      storePoppedOutWindowRecord(nextWindowRecord);
      if (isDebugConsoleWindow(windowRecord) || isNotesWindow(windowRecord) || isTreeDataSurfaceWindow(windowRecord)
        || windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.dummyWindow) {
        appServices.surfaces.update(windowId, {
          placement: { host: 'native', windowId },
        });
      }
      await invoke('window_host_pop_out', {
        windowRecord: nextWindowRecord,
      });
    } catch (error) {
      removePoppedOutWindowRecord(windowId);
      if (isDebugConsoleWindow(windowRecord) || isNotesWindow(windowRecord) || isTreeDataSurfaceWindow(windowRecord)
        || windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.dummyWindow) {
        appServices.surfaces.update(windowId, {
          placement: { host: 'dockview', mode: 'edge', edge: 'top' },
        });
      }
      console.error('failed to pop out window:', error);
    }
  }

  async function handlePopInWindow(windowId: string): Promise<void> {
    try {
      await invoke('window_host_pop_in', { windowId });
    } catch (error) {
      console.error('failed to pop in window:', error);
    }
  }

  function closeLoggingModal(): void {
    loggingModalTabId = null;
    appServices.notice.closeNotice();
  }

  function refreshLoggingModalStatus(): void {
    loggingModalRefreshNonce += 1;
  }

  function closeActiveNotice(): void {
    const activeNotice = appServices.notice.getCurrent();
    if (!activeNotice) {
      return;
    }

    if (activeNotice.kind === 'custom') {
      if (activeNotice.surfaceId === APP_NOTICE_SURFACE_IDS.characterModal || activeNotice.surfaceId === APP_NOTICE_SURFACE_IDS.worldModal) {
        session.closeModal();
        return;
      }

      if (activeNotice.surfaceId === APP_NOTICE_SURFACE_IDS.loggingModal) {
        closeLoggingModal();
        return;
      }
    }

    if (activeNotice.kind === 'alert') {
      appServices.notice.acceptCurrentNotice();
      return;
    }

    appServices.notice.dismissCurrentNotice();
  }

  function hasBlockingWindow(): boolean {
    return getRegisteredWindowRecords().some((windowRecord) => windowRecord.isModal);
  }

  function isModalOpen(): boolean {
    return (
      $session.modalOpen ||
      $appNoticeStore !== null ||
      hasBlockingWindow() ||
      ($session.closeConfirmTabId !== null && $session.closeConfirmMode === 'modal')
    );
  }

  function hasConnectedWorldTabs(): boolean {
    return $session.tabs.some((tab) => {
      if (tab.kind !== 'world') {
        return false;
      }

      const sessionState = $session.worldSessions[tab.id];
      return (
        sessionState?.connectionStatus === 'connected' ||
        sessionState?.connectionStatus === 'connecting'
      );
    });
  }

  function getCloseConfirmCopy(tabId: string): { title: string; message: string; confirmLabel: string } {
    const sessionState = $session.worldSessions[tabId];
    const worldName =
      sessionState?.currentWorld?.name ??
      sessionState?.currentCharacter?.name ??
      $session.tabs.find((tab) => tab.id === tabId)?.title ??
      'this world';

    if (
      sessionState?.connectionStatus === 'connected' ||
      sessionState?.connectionStatus === 'connecting'
    ) {
      return {
        title: 'close world tab?',
        message: `World ${worldName} is connected. Disconnect and close?`,
        confirmLabel: 'disconnect and close',
      };
    }

    return {
      title: 'close world tab?',
      message: `World ${worldName} is not being logged. Close anyway?`,
      confirmLabel: 'close anyway',
    };
  }

  async function closePoppedOutSurfaceWindows(): Promise<void> {
    const poppedOutWindowIds = Object.keys(poppedOutWindowRecords);
    if (poppedOutWindowIds.length === 0) {
      return;
    }

    poppedOutWindowIds.forEach((windowId) => closeWindow(windowId));
    poppedOutWindowRecords = {};

    await Promise.all(
      poppedOutWindowIds.map((windowId) =>
        invoke('window_host_discard', { windowId }).catch((error) => {
          console.error('failed to discard popped-out surface during app close:', error);
        }),
      ),
    );
  }

  async function closeAppAfterCleanup(): Promise<void> {
    try {
      await closePoppedOutSurfaceWindows();
      const currentWindow = getCurrentWebviewWindow();
      if (!currentWindow) {
        return;
      }

      allowWindowCloseOnce = true;
      await currentWindow.close();
    } catch (error) {
      allowWindowCloseOnce = false;
      console.error('failed to close the app window:', error);
    }
  }

  function handleAppCloseRequest(event: { preventDefault: () => void }): void {
    console.log('[window-action] app close requested', {
      allowWindowCloseOnce,
      hasBlockingWindow: hasBlockingWindow(),
      hasConnectedWorldTabs: hasConnectedWorldTabs(),
      modalOpen: $session.modalOpen,
      loggingModalTabId,
      notice: $appNoticeStore?.surfaceId ?? null,
    });

    if (allowWindowCloseOnce) {
      allowWindowCloseOnce = false;
      console.log('[window-action] app close allowed once');
      return;
    }

    if ($session.modalOpen || $appNoticeStore !== null || hasBlockingWindow() || loggingModalTabId !== null || ($session.closeConfirmTabId !== null && $session.closeConfirmMode === 'modal')) {
      event.preventDefault();
      void invoke('window_cancel_close_fallback');
      console.log('[window-action] app close prevented by blocking state');
      return;
    }

    if (!hasConnectedWorldTabs()) {
      event.preventDefault();
      void closeAppAfterCleanup();
      console.log('[window-action] app close cleanup started without confirmation');
      return;
    }

    event.preventDefault();
    void invoke('window_cancel_close_fallback');
    void appServices.notice.confirm({
      surfaceId: APP_NOTICE_SURFACE_IDS.appCloseConfirm,
      title: 'close app?',
      message: 'One or more tabs are connected. Disconnect and close the app?',
      confirmLabel: 'disconnect and close app',
      cancelLabel: 'cancel',
    }).then((accepted) => {
      if (accepted) {
        void confirmAppClose();
      }
    });
    console.log('[window-action] app close confirmation opened');
  }

  async function confirmAppClose(): Promise<void> {
    console.log('[window-action] app close confirm cleanup started');
    await closeAppAfterCleanup();
  }

  $: activeTab = $session.tabs.find((tab) => tab.id === $session.activeTabId) ?? null;
  $: activeWorldSession =
    activeTab?.kind === 'world' ? $session.worldSessions[activeTab.id] ?? null : null;
  $: loggingModalTab = loggingModalTabId ? $session.tabs.find((tab) => tab.id === loggingModalTabId) ?? null : null;
  $: loggingModalSession =
    loggingModalTab?.kind === 'world' ? $session.worldSessions[loggingModalTab.id] ?? null : null;
  $: loggingModalInitialFileName =
    loggingModalSession?.loggingActive && loggingModalSession.logFilePath
      ? getLogFileName(loggingModalSession.logFilePath)
      : loggingModalSession?.currentWorld
        ? generateLogFilename(loggingModalSession.currentWorld.name, loggingModalSession.currentCharacter?.name ?? 'world')
        : '';

  $: pageTitle =
    activeTab?.kind === 'settings'
      ? `App Settings · MUDShow`
      : activeTab?.kind === 'triggers'
        ? 'Triggers · MUDShow'
      : activeTab?.kind === 'world' && activeWorldSession?.currentWorld
        ? $appSettingsStore.titleAttention && activeWorldSession.hasNewActivity
          ? `* ${activeWorldSession.currentCharacter ? `${activeWorldSession.currentWorld.name} · ${activeWorldSession.currentCharacter.name}` : activeWorldSession.currentWorld.name}`
          : activeWorldSession.currentCharacter
            ? `${activeWorldSession.currentWorld.name} · ${activeWorldSession.currentCharacter.name}`
            : activeWorldSession.currentWorld.name
        : 'MUDShow';

  $: if (!isPoppedOutWindow) {
    syncPoppedOutTreeDataSnapshots(
      treeDataInvalidationVersion,
      Object.keys(poppedOutWindowRecords).join('|'),
      getRegisteredWindowRecords().length,
    );
    syncPoppedOutDebugConsoleSnapshots(
      debugConsoleCacheVersion,
      Object.keys(poppedOutWindowRecords).join('|'),
      getRegisteredWindowRecords().length,
    );
    syncPoppedOutNotesSnapshots(
      Object.keys(poppedOutWindowRecords).join('|'),
      getRegisteredWindowRecords().length,
    );
  }

  onMount(() => {
    const unlistenSurfaceRegistry = appServices.surfaces.subscribe(() => {
      surfaceRegistryVersion += 1;
    });
    console.log('[window-action] app mount state', {
      isPoppedOutWindow,
      poppedOutWindowId,
      url: typeof window !== 'undefined' ? window.location.href : null,
    });
    const unlistenPluginSurfaceInvalidation = pluginTreeDataSurfaceController.subscribeInvalidation(() => {
      treeDataInvalidationVersion += 1;
      treeDataRefreshVersion += 1;
      logTreeTransport('plugin surface cache changed', {
        version: treeDataInvalidationVersion,
      });
    });
    const unlistenDebugConsoleCache = debugConsoleCache.subscribe(() => {
      debugConsoleCacheVersion += 1;
      logDebugConsoleTransport('debug console cache changed', {
        version: debugConsoleCacheVersion,
      });
    });
    const handleVisibilityChange = () => session.handleVisibilityChange();
    const handleWindowFocus = () => session.handleWindowFocus();
    let unlistenWindowHostEvents: Array<() => void> = [];
    const handleKeyDown = (event: KeyboardEvent) => {
      const isReloadKey =
        event.key === 'F5' ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r');

      if (isReloadKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.ctrlKey && event.key === 'Tab' && !isModalOpen()) {
        event.preventDefault();
        if (event.shiftKey) {
          void session.selectPreviousTab();
        } else {
          void session.selectNextTab();
        }
        return;
      }

      if (event.key === 'F3') {
        const activeWorldTab = $session.tabs.find(
          (tab): tab is AppTab & { kind: 'world' } => tab.id === $session.activeTabId && tab.kind === 'world',
        );
        if (activeWorldTab) {
          event.preventDefault();
          event.stopPropagation();
          openOrFocusNotesWindow(activeWorldTab.id);
          return;
        }
      }

      session.handleGlobalKeyDown(event);
    };
    const startupOverlay = document.getElementById('startup-overlay');
    let disposed = false;

    void (async () => {
      if (isPoppedOutWindow) {
        console.log('[window-action] popped-out window startup branch entered', {
          poppedOutWindowId,
        });
        if (!poppedOutWindowId) {
          console.log('[window-action] popped-out window missing id, removing startup overlay only');
          startupOverlay?.remove();
          return;
        }

        try {
          const record = await invoke<WindowRecord | null>('window_host_get_record', {
            windowId: poppedOutWindowId,
          });
          if (disposed) {
            console.log('[window-action] popped-out window startup aborted after record fetch', {
              poppedOutWindowId,
            });
            return;
          }

          poppedOutWindowRecord = record;
          if (record) {
            storePoppedOutWindowRecord(record);
          }
          console.log('[window-action] popped-out window record loaded', {
            poppedOutWindowId,
            hasRecord: record !== null,
          });
        } catch (error) {
          console.error('failed to load popped out window record:', error);
        }

        startupOverlay?.remove();
        console.log('[window-action] popped-out window startup overlay removed', {
          poppedOutWindowId,
        });

        return;
      }

      try {
        session.setConfirmUnloggedTabClose($appSettingsStore.confirmUnloggedTabClose);
        session.setWorldPluginSurfaceHandler(handleWorldPluginSurfaceOpen);
        await appServices.lifecycle.runHooks('startup');
        session.setTranscriptScrollbackChunks($appSettingsStore.transcriptScrollbackChunks);
        if (disposed) {
          return;
        }

        await session.load();
        await session.recoverWorldConnections();
        await tick();
        syncPoppedOutNotesSnapshots();
      } finally {
        if (!disposed) {
          startupOverlay?.remove();
        }
      }
    })();

    void (async () => {
      try {
        const currentWebviewWindow = getCurrentWebviewWindow();
        if (!currentWebviewWindow) {
          return;
        }

        if (!isPoppedOutWindow) {
          const unlistenTreeCommand = await listen<SurfaceTransportBridgeCommandEnvelope<TreeDataWindowCommand | DebugConsoleWindowCommand | NotesWindowCommand>>(
            'surface-transport:command',
            (event) => {
              const payload = event.payload;
              const windowRecord = poppedOutWindowRecords[payload.instanceId] ?? null;
              if (!windowRecord) {
                return;
              }

              if (isPoppedOutTreeWindow(windowRecord)) {
                logTreeTransport('bridge command received', {
                  windowId: payload.instanceId,
                  surfaceId: payload.surfaceId,
                  expectedRevision: payload.expectedRevision ?? null,
                  command: payload.payload,
                });
                handleTreeDataTransportCommand(
                  payload.instanceId,
                  payload.payload as TreeDataWindowCommand,
                  payload.expectedRevision ?? payload.revision,
                );
                return;
              }

              if (!isDebugConsoleWindow(windowRecord)) {
                if (!isNotesWindow(windowRecord)) {
                  return;
                }

                logNotesTransport('bridge command received', {
                  windowId: payload.instanceId,
                  surfaceId: payload.surfaceId,
                  expectedRevision: payload.expectedRevision ?? null,
                  command: payload.payload,
                });
                handleNotesTransportCommand(
                  payload.instanceId,
                  payload.payload as NotesWindowCommand,
                  payload.expectedRevision ?? payload.revision,
                );
                return;
              }

              logDebugConsoleTransport('bridge command received', {
                windowId: payload.instanceId,
                surfaceId: payload.surfaceId,
                expectedRevision: payload.expectedRevision ?? null,
                command: payload.payload,
              });
              handleDebugConsoleTransportCommand(
                payload.instanceId,
                payload.payload as DebugConsoleWindowCommand,
                payload.expectedRevision ?? payload.revision,
              );
            },
          );

          const unlistenTreeLifecycle = await listen<SurfaceTransportBridgeLifecycleEnvelope>(
            'surface-transport:lifecycle',
            (event) => {
              const payload = event.payload;
              const windowRecord = poppedOutWindowRecords[payload.instanceId] ?? null;
              if (!windowRecord) {
                return;
              }

              if (isPoppedOutTreeWindow(windowRecord)) {
                logTreeTransport('bridge lifecycle received', {
                  windowId: payload.instanceId,
                  surfaceId: payload.surfaceId,
                  kind: payload.payload.type,
                  revision: payload.revision,
                });

                if (payload.payload.type !== 'stateReconciled') {
                  return;
                }

                const targetWindowRecord = poppedOutWindowRecords[payload.instanceId] ?? null;
                if (targetWindowRecord && isPoppedOutTreeWindow(targetWindowRecord)) {
                  emitTreeDataBridgeSnapshotForWindow(payload.instanceId, targetWindowRecord, true);
                }
                return;
              }

              if (!isDebugConsoleWindow(windowRecord)) {
                if (!isNotesWindow(windowRecord)) {
                  return;
                }

                logNotesTransport('bridge lifecycle received', {
                  windowId: payload.instanceId,
                  surfaceId: payload.surfaceId,
                  kind: payload.payload.type,
                  revision: payload.revision,
                });

                if (payload.payload.type !== 'stateReconciled') {
                  return;
                }

                const targetWindowRecord = poppedOutWindowRecords[payload.instanceId] ?? null;
                if (targetWindowRecord && isNotesWindow(targetWindowRecord)) {
                  emitNotesBridgeSnapshotForWindow(payload.instanceId, targetWindowRecord, true);
                }
                return;
              }

              logDebugConsoleTransport('bridge lifecycle received', {
                windowId: payload.instanceId,
                surfaceId: payload.surfaceId,
                kind: payload.payload.type,
                revision: payload.revision,
              });

              if (payload.payload.type !== 'stateReconciled') {
                return;
              }

              const targetWindowRecord = poppedOutWindowRecords[payload.instanceId] ?? null;
              if (targetWindowRecord && isDebugConsoleWindow(targetWindowRecord)) {
                emitDebugConsoleBridgeSnapshotForWindow(payload.instanceId, targetWindowRecord, true);
              }
            },
          );

          unlistenTreeBridgeEvents = [unlistenTreeCommand, unlistenTreeLifecycle];
        }

        if (isPoppedOutWindow && poppedOutWindowId) {
          console.log('[window-action] installing popped-out window close handler', {
            poppedOutWindowId,
          });
          unlistenAppClose = await currentWebviewWindow.onCloseRequested(async (event) => {
            console.log('[window-action] popped-out window close requested', {
              poppedOutWindowId,
            });
            event.preventDefault();

            try {
              console.log('[window-action] discarding popped-out window record', {
                poppedOutWindowId,
              });
              await invoke('window_host_discard', { windowId: poppedOutWindowId });
              console.log('[window-action] discarded popped-out window record', {
                poppedOutWindowId,
              });
            } catch (error) {
              console.error('failed to discard popped out window:', error);
            } finally {
              console.log('[window-action] destroying popped-out native window', {
                poppedOutWindowId,
              });
              await currentWebviewWindow.destroy();
              console.log('[window-action] destroyed popped-out native window', {
                poppedOutWindowId,
              });
            }
          });
        } else {
          console.log('[window-action] installing main window close handler');
          unlistenAppClose = await currentWebviewWindow.onCloseRequested(handleAppCloseRequest);
          const unlistenPopIn = await listen<WindowRecord>('window-host:pop-in-requested', (event) => {
            console.log('[window-event] popped-out window pop-in requested', {
              windowId: event.payload.id,
            });
            handlePoppedOutWindowReturned(event.payload);
          });
          const unlistenDiscarded = await listen<WindowRecord>('window-host:discarded', (event) => {
            console.log('[window-event] popped-out window discarded', {
              windowId: event.payload.id,
            });
            handlePoppedOutWindowDiscarded(event.payload);
          });
          unlistenWindowHostEvents = [unlistenPopIn, unlistenDiscarded];
          if (disposed) {
            unlistenWindowHostEvents.forEach((unlisten) => unlisten());
            unlistenWindowHostEvents = [];
            unlistenTreeBridgeEvents.forEach((unlisten) => unlisten());
            unlistenTreeBridgeEvents = [];
            return;
          }
          document.addEventListener('visibilitychange', handleVisibilityChange);
          window.addEventListener('focus', handleWindowFocus);
          window.addEventListener('keydown', handleKeyDown, { capture: true });
        }

        if (disposed) {
          unlistenAppClose?.();
          unlistenAppClose = null;
          return;
        }
      } catch (error) {
        console.error('failed to install app close handler:', error);
      }
    })();

    return () => {
      disposed = true;
      console.log('[window-action] app cleanup', {
        isPoppedOutWindow,
        poppedOutWindowId,
      });
      unlistenPluginSurfaceInvalidation();
      unlistenDebugConsoleCache();
      unlistenSurfaceRegistry();
      if (!isPoppedOutWindow) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
      }
      unlistenAppClose?.();
      unlistenAppClose = null;
      unlistenWindowHostEvents.forEach((unlisten) => unlisten());
      unlistenWindowHostEvents = [];
      unlistenTreeBridgeEvents.forEach((unlisten) => unlisten());
      unlistenTreeBridgeEvents = [];
      if (isPoppedOutWindow && poppedOutWindowId) {
        clearTreeDataBridgeSession(poppedOutWindowId);
      }
      session.dispose();
    };
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

{#if isPoppedOutWindow}
  <PoppedOutWindowView
    windowRecord={poppedOutWindowRecord ?? createWindowRecord({
      id: poppedOutWindowId ?? 'popped-out-window',
      surfaceId: WINDOW_HOST_SINGLETON_IDS.dummyWindow,
      title: 'window',
    })}
    themeClassName={appThemeClassName}
    onPopIn={(windowId) => void handlePopInWindow(windowId)}
  >
    {#if poppedOutWindowRecord?.surfaceId === WINDOW_HOST_SINGLETON_IDS.dummyWindow}
      <DummyWindowContent instanceLabel={poppedOutWindowRecord.title} />
    {:else if poppedOutWindowRecord
      && isTreeDataSurfaceWindow(poppedOutWindowRecord)}
      {@const treeDataWindowProps = getTreeDataWindowRenderProps(poppedOutWindowRecord.id, treeDataInvalidationVersion)}
      {#if treeDataWindowProps}
        <TreeDataWindow {...treeDataWindowProps} />
      {:else}
        {@const placeholderModel = createTreeDataWindowPlaceholderModel(poppedOutWindowRecord.title)}
        {@const placeholderViewState = treeDataViewController.ensure(poppedOutWindowRecord.id, placeholderModel.root.id)}
        <TreeDataWindow
          model={placeholderModel}
          viewState={placeholderViewState}
          onCommand={() => {}}
          transportSession={null}
        />
      {/if}
    {:else if poppedOutWindowRecord && isDebugConsoleWindow(poppedOutWindowRecord)}
      {@const debugConsoleWindowProps = getDebugConsoleWindowRenderProps(poppedOutWindowRecord.id, debugConsoleCacheVersion)}
      {#if debugConsoleWindowProps}
        <DebugConsoleWindow {...debugConsoleWindowProps} />
      {:else}
        {@const placeholderModel = createDebugConsoleWindowPlaceholderModel(poppedOutWindowRecord.title)}
        <DebugConsoleWindow model={placeholderModel} onCommand={() => {}} transportSession={null} />
      {/if}
    {:else if poppedOutWindowRecord && isNotesWindow(poppedOutWindowRecord)}
      {@const notesWindowProps = getNotesWindowRenderProps(poppedOutWindowRecord.id)}
      {#if notesWindowProps}
        <NotesWindow {...notesWindowProps} />
      {:else}
        {@const placeholderModel = createNotesWindowPlaceholderModel(poppedOutWindowRecord.title)}
        <NotesWindow model={placeholderModel} onCommand={() => {}} transportSession={null} />
      {/if}
    {/if}
  </PoppedOutWindowView>
{:else}
<div id="app-shell" class={appThemeClassName}>
  <TopBar
    tabs={$session.tabs}
    activeTabId={$session.activeTabId}
    worldSessions={$session.worldSessions}
    dockviewThemeId={$appSettingsStore.colorScheme}
    closeConfirmTabId={$session.closeConfirmTabId}
    closeConfirmMode={$session.closeConfirmMode}
    confirmUnloggedTabClose={$appSettingsStore.confirmUnloggedTabClose}
    transcriptDiagnosticsEnabled={$session.transcriptDiagnosticsEnabled}
    worlds={$session.worlds}
    characters={$session.characters}
    onSelectTab={(tabId) => session.selectTab(tabId)}
    onReorderTab={(tabId, targetIndex) => session.reorderTab(tabId, targetIndex)}
    onCloseTab={(tabId, source) => session.closeTab(tabId, source)}
    onCancelCloseConfirm={() => session.cancelCloseConfirm()}
    onConfirmCloseTab={() => session.confirmCloseTab()}
    onReconnectTab={(tabId) => void session.reconnectWorldTab(tabId)}
    onDisconnectTab={(tabId) => void session.disconnectWorldTab(tabId)}
    onQuickLogTab={(tabId) => void session.startLogging(tabId, appServices.storage.getResolvedDefaultLogFolder() ?? $appSettingsStore.defaultLogFolder ?? null, null)}
    onOpenLoggingTab={(tabId) => openLoggingModal(tabId)}
    onStopLoggingTab={(tabId) => void session.stopLogging(tabId)}
    onConnectWorld={(worldId) => void session.connectToWorld(worldId)}
    onConnectCharacter={(index) => void session.connectToCharacter(index)}
    onOpenCharactersTab={() => session.selectTab('characters')}
    onEditWorldTab={(tabId) => void session.openWorldEditorFromWorldTab(tabId)}
    onEditCharacterTab={(tabId) => void session.openCharacterEditorFromWorldTab(tabId)}
    onOpenNotesTab={(tabId) => {
      session.activateWorldTab(tabId);
      openOrFocusNotesWindow(tabId);
    }}
    onOpenDebugConsoleTab={(tabId) => {
      session.activateWorldTab(tabId);
      openDebugConsoleWindow(tabId);
    }}
    onOpenTriggersTab={(worldId, characterId) => session.openTriggersTab(worldId, characterId)}
    onOpenStylesTab={openDefaultStyleSettings}
    onOpenDummyWindow={openDummyWindow}
    onOpenTreeDataWindow={openTreeDataWindow}
    onToggleTranscriptDiagnostics={toggleTranscriptDiagnostics}
  />

  <main id="app-main">
    {#if activeTab === null}
      <HomePanel
        worlds={$session.worlds}
        characters={$session.characters}
        onConnectWorld={(worldId) => void session.connectToWorld(worldId)}
        onConnectCharacter={(index) => void session.connectToCharacter(index)}
        onOpenCharactersTab={() => session.selectTab('characters')}
        onOpenSettings={() => session.selectTab('settings')}
      />
    {:else if activeTab.kind === 'characters'}
      <WorldsAndCharactersEditor
        worlds={$session.worlds}
        characters={$session.characters}
        onOpenWorld={(index) => void session.openWorldModal(index)}
        onEditWorld={(index) => void session.openWorldModal(index)}
        onDeleteWorld={(index) => void session.deleteWorld(index)}
        onOpenCharacter={(worldId, index) => void session.openCharacterModal(worldId, index)}
        onEditCharacter={(index) => {
          const character = $session.characters[index];
          if (character) {
            void session.openCharacterModal(character.worldId, index);
          }
        }}
        onDeleteCharacter={(index) => session.deleteCharacter(index)}
        onConnectWorld={(worldId) => void session.connectToWorld(worldId)}
        onConnectCharacter={(index) => void session.connectToCharacter(index)}
        onOpenSettings={() => session.selectTab('settings')}
      />
    {/if}

    {#each $session.tabs.filter((tab) => tab.kind === 'world') as tab (tab.id)}
      {@const worldSession = $session.worldSessions[tab.id] ?? session.getWorldSession(tab.id)}
      {@const channels = session.channels.getWorldChannelsViewModel(tab.id, {
        controls: session.getWorldPluginActions(tab.id)
          .filter((action) => action.kind === 'button')
          .map((action) => ({
            id: action.id,
            label: action.label,
            title: action.title,
            disabled: action.disabled,
            onClick: action.onClick,
          })),
        scope: tab.id,
        activeBar: worldSession.activeBar,
      })}
      {@const playScreenActions = createPlayScreenActions(tab, worldSession)}
      {@const debugConsolePanel = getDebugConsoleDockviewPanel(tab.id, surfaceRegistryVersion)}
      {@const notesPanel = getNotesDockviewPanel(tab.id, surfaceRegistryVersion)}
      {@const treeDataPanels = [
        ...getTreeDataDockviewPanels(tab.id, tab.id === $session.activeTabId, surfaceRegistryVersion, treeDataRefreshVersion),
      ]}
      {@const dummyPanels = getDummyDockviewPanels(tab.id === $session.activeTabId, surfaceRegistryVersion)}
      <PlayScreen
        scope={tab.id}
        dockviewThemeId={$appSettingsStore.colorScheme}
        visible={tab.id === $session.activeTabId}
        styleValues={$resolvedAppStyle}
        activeBar={worldSession.activeBar}
        connectionStatus={worldSession.connectionStatus}
        hasNewActivity={worldSession.hasNewActivity}
        bars={worldSession.inputBars}
        topActions={session.getWorldPluginActions(tab.id)}
        {debugConsolePanel}
        {notesPanel}
        {treeDataPanels}
        {dummyPanels}
        focusSurfaceId={tab.id === $session.activeTabId ? focusSurfaceId : null}
        {focusSurfaceRequestVersion}
        triggers={worldSession.currentCharacter
          ? getTriggersForCharacter($session.triggers, worldSession.currentCharacter)
          : worldSession.currentWorld
            ? getTriggersForWorld($session.triggers, worldSession.currentWorld.id)
            : []}
        channels={channels}
        linkImagePreviews={$appSettingsStore.linkImagePreviews}
        showCurrentOutputWhenScrollingUp={$appSettingsStore.showCurrentOutputWhenScrollingUp}
        squiggleOpacity={$appSettingsStore.squiggleOpacity}
        squiggleColor={$appSettingsStore.squiggleColor}
        squiggleStyle={$appSettingsStore.squiggleStyle}
        squiggleSize={$appSettingsStore.squiggleSize}
        userScrolled={worldSession.userScrolled}
        lastActivityMarker={worldSession.lastActivityMarker}
        chunkSelectRangeMin={$appSettingsStore.chunkSelectRangeMin}
        transcript={worldSession.transcript}
        outputRevision={worldSession.outputRevision}
        renderCache={worldSession.renderCache}
        characterWidth={worldSession.currentCharacter?.width}
        outputFontSize={$resolvedAppStyle.output.fontSize}
        transcriptDiagnosticsEnabled={$session.transcriptDiagnosticsEnabled}
        loggingActive={worldSession.loggingActive}
        imagePreviewCacheVersion={$appSettingsStore.imagePreviewCacheVersion}
        canReconnect={worldSession.connectionStatus === 'disconnected' && worldSession.currentWorld !== null}
        canDisconnect={worldSession.connectionStatus === 'connecting' || worldSession.connectionStatus === 'connected'}
        canQuickLog={!worldSession.loggingActive}
        canStopLogging={worldSession.loggingActive}
        canEditWorld={worldSession.currentWorld !== null}
        canEditCharacter={worldSession.currentCharacter !== null}
        actions={playScreenActions}
      />
    {/each}

    {#if activeTab?.kind === 'triggers'}
      <TriggersPane
        worlds={$session.worlds}
        characters={$session.characters}
        triggers={$session.triggers}
        contextWorldId={$session.triggersContextWorldId}
        contextCharacterId={$session.triggersContextCharacterId}
        onHighlightSave={(id, owner, draft) => session.saveHighlightDraft(id, owner, draft)}
        onHighlightDelete={(id) => session.deleteHighlight(id)}
        onRuleSave={(id, owner, draft) => session.saveRuleDraft(id, owner, draft)}
        onRuleDelete={(id) => session.deleteRule(id)}
        onTriggerMove={(id, owner, beforeTriggerId) => session.moveTrigger(id, owner, beforeTriggerId)}
      />
    {/if}

    {#if activeTab?.kind === 'settings'}
      <SettingsPage
        activeTab={$session.settingsActiveTab}
        onTabChange={(tab) => session.setSettingsActiveTab(tab)}
      />
    {/if}
  </main>
</div>

<WindowResizeHandles />

{#if $appNoticeStore}
  <AppNoticeHost
    open={true}
    title={$appNoticeStore.title}
    themeClassName={appThemeClassName}
    onClose={closeActiveNotice}
  >
    {#if $appNoticeStore.kind === 'custom' && $appNoticeStore.surfaceId === APP_NOTICE_SURFACE_IDS.characterModal}
      <CharacterModal
        draft={$session.modalDraft}
        onCancel={() => session.closeModal()}
        onSave={(draft) => session.saveCharacter(draft)}
      />
    {:else if $appNoticeStore.kind === 'custom' && $appNoticeStore.surfaceId === APP_NOTICE_SURFACE_IDS.worldModal}
      <WorldModal
        draft={$session.worldModalDraft}
        onCancel={() => session.closeModal()}
        onSave={(draft) => session.saveWorld(draft)}
      />
    {:else if $appNoticeStore.kind === 'custom' && $appNoticeStore.surfaceId === APP_NOTICE_SURFACE_IDS.loggingModal}
      <LoggingModal
        active={loggingModalSession?.loggingActive === true}
        tabTitle={loggingModalTab?.title ?? ''}
        currentPath={loggingModalSession?.logFilePath ?? ''}
        defaultFolder={appServices.storage.getResolvedDefaultLogFolder() ?? $appSettingsStore.defaultLogFolder ?? ''}
        initialFileName={loggingModalInitialFileName}
        logError={loggingModalSession?.logError ?? ''}
        refreshNonce={loggingModalRefreshNonce}
        onStartLogging={async (fileName) => {
          if (!loggingModalTabId) {
            return;
          }

          await session.startLogging(loggingModalTabId, appServices.storage.getResolvedDefaultLogFolder() ?? $appSettingsStore.defaultLogFolder ?? null, fileName);
          refreshLoggingModalStatus();
          closeLoggingModal();
        }}
        onStopLogging={() => {
          if (!loggingModalTabId) {
            return;
          }

          void session.stopLogging(loggingModalTabId);
          closeLoggingModal();
        }}
        onRenameLogging={async (fileName) => {
          if (!loggingModalTabId) {
            return;
          }

          await session.renameLogging(loggingModalTabId, fileName);
          refreshLoggingModalStatus();
          closeLoggingModal();
        }}
        onRevealLog={() => {
          if (!loggingModalTabId) {
            return;
          }

          const loggingSession = loggingModalSession;
          if (loggingSession?.logFilePath) {
            void session.revealLoggingFile(loggingModalTabId);
            return;
          }

          void appServices.storage.revealDefaultLogFolder(appServices.storage.getResolvedDefaultLogFolder() ?? $appSettingsStore.defaultLogFolder ?? null);
        }}
        onOpenLoggingSettings={() => {
          closeLoggingModal();
          session.selectTab('settings');
          session.setSettingsActiveTab('logging');
        }}
      />
    {:else if $appNoticeStore.kind === 'alert'}
      <NoticeModal
        message={$appNoticeStore.message ?? ''}
        confirmLabel={$appNoticeStore.confirmLabel ?? 'ok'}
        onClose={() => appServices.notice.acceptCurrentNotice()}
      />
    {:else if $appNoticeStore.kind === 'confirm'}
      <ConfirmCloseTabModal
        title={$appNoticeStore.title}
        message={$appNoticeStore.message ?? ''}
        confirmLabel={$appNoticeStore.confirmLabel ?? 'ok'}
        onCancel={() => appServices.notice.dismissCurrentNotice()}
        onConfirm={() => appServices.notice.acceptCurrentNotice()}
      />
    {/if}
  </AppNoticeHost>
{/if}

{/if}
