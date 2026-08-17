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
import SettingsPage from './lib/components/settings/SettingsPage.svelte';
import TriggersPane from './lib/components/settings/TriggersPane.svelte';
import WindowHost from './lib/components/window-host/WindowHost.svelte';
import DummyWindowContent from './lib/components/window-host/DummyWindowContent.svelte';
import TreeDataWindow from './lib/components/tree-data/TreeDataWindow.svelte';
import {
  createDemoTreeDataWindowModel,
} from './lib/components/tree-data/tree-data-demo-fixture';
import {
  findTreeDataNode,
  type TreeDataWindowModel,
} from './lib/components/tree-data/tree-data-view';
import {
  createFuzzballStorageViewerState,
  buildFuzzballStorageViewerModel,
  requestFuzzballStorageNodeLoad,
  type FuzzballStorageViewerState,
} from './lib/fuzzball/storage-viewer';
import PoppedOutWindowView from './lib/components/window-host/PoppedOutWindowView.svelte';
import { createWindowRecord, type WindowPoint, type WindowRecord } from './lib/components/window-host/window-host';
import TopBar from './lib/components/window/TopBar.svelte';
import WindowResizeHandles from './lib/components/window/WindowResizeHandles.svelte';
import WorldModal from './lib/components/settings/WorldModal.svelte';
import { session } from './lib/session';
import { generateLogFilename, getLogFileName } from './lib/logging';
import type { AppTab } from './lib/tabs';
import type { WorldTabSessionState } from './lib/world-session';
import { getTriggersForCharacter, getTriggersForWorld } from './lib/triggers';
import { getCurrentWebviewWindow, invoke, listen } from './lib/tauri';

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

const appSettingsStore = appServices.settings.current;
const appNoticeStore = appServices.notice.current;
let loggingModalTabId: string | null = null;
let activeTab: AppTab | null = null;
let activeWorldSession: WorldTabSessionState | null = null;
let loggingModalSession: WorldTabSessionState | null = null;
let loggingModalTab: AppTab | null = null;
let loggingModalInitialFileName = '';
let loggingModalRefreshNonce = 0;
let windowHostWindows: WindowRecord[] = [];
let poppedOutWindowRecords: Record<string, WindowRecord> = {};
let poppedOutWindowId: string | null = initialPoppedOutWindowId ?? null;
let poppedOutWindowRecord: WindowRecord | null = null;
let isPoppedOutWindow = initialIsPoppedOutWindow;
let nextWindowHostId = 1;
let fuzzballStorageWindowStates: Record<string, FuzzballStorageViewerState> = {};
let previousWorldTabIds = new Set<string>();
let allowWindowCloseOnce = false;
let unlistenAppClose: (() => void) | null = null;

type TreeDataWindowRenderProps = {
  model: TreeDataWindowModel;
  onToggleNode?: (nodeId: string) => void;
};

const resolvedAppStyle = appServices.style.resolved;

$: {
  session.setConfirmUnloggedTabClose($appSettingsStore.confirmUnloggedTabClose);
  session.setTranscriptScrollbackChunks($appSettingsStore.transcriptScrollbackChunks);
}

function toggleTranscriptDiagnostics(): void {
    session.toggleTranscriptDiagnosticsEnabled();
}

$: {
    const currentWorldTabIds = new Set(
      $session.tabs
        .filter((tab): tab is AppTab & { kind: 'world' } => tab.kind === 'world')
        .map((tab) => tab.id),
    );

    for (const tabId of previousWorldTabIds) {
      if (!currentWorldTabIds.has(tabId)) {
        void discardFuzzballStorageWindowsForSourceTab(tabId);
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
      onOpenNotes: () => void session.togglePanel('notes'),
      onOpenTriggers: () =>
        session.openTriggersTab(worldSession.currentWorld?.id ?? null, worldSession.currentCharacter?.id ?? null),
      onOpenDebugConsole: () => void session.togglePanel('debugConsole'),
      onOpenStyles: () => openDefaultStyleSettings(),
      onInputFocusBar: (bar: number) => session.handleInputFocus(bar),
      onInputSubmit: (bar: number, value: string) => session.handleInputSubmit(bar, value),
      onInputComplete: (_bar: number, value: string, selectionStart: number) =>
        session.completeInput(value, selectionStart),
      onInputAddBar: (bar: number) => void session.addInputBarAfter(bar),
      onInputRemoveBar: (bar: number) => void session.removeInputBar(bar),
      onInputResizeBar: (bar: number, delta: -1 | 1) => session.resizeInputBar(bar, delta),
      onSpellcheckIgnoreWord: (word: string) => void appServices.spellcheck.ignoreWord(word),
      onNotesClose: () => void session.togglePanel('notes'),
      onDebugConsoleClose: () => void session.togglePanel('debugConsole'),
      onOutputScroll: () => session.handleOutputScroll(),
      onOutputScrollKey: (action: 'top' | 'bottom' | 'page-up' | 'page-down') =>
        session.handleOutputScrollKey(action),
      onScrollToBottom: () => session.handleScrollToBottom(),
    };
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

  function isSameWindowRecord(left: WindowRecord, right: WindowRecord): boolean {
    return (
      left.id === right.id &&
      left.kind === right.kind &&
      left.surfaceId === right.surfaceId &&
      left.title === right.title &&
      left.isModal === right.isModal &&
      left.sizeToContent === right.sizeToContent &&
      left.placement === right.placement &&
      left.position.x === right.position.x &&
      left.position.y === right.position.y &&
      left.size.width === right.size.width &&
      left.size.height === right.size.height &&
      left.canBackdropDismiss === right.canBackdropDismiss &&
      left.canEscapeDismiss === right.canEscapeDismiss &&
      left.canPopOut === right.canPopOut &&
      left.canMoveInApp === right.canMoveInApp
    );
  }

  function upsertWindowRecord(windowRecord: WindowRecord): void {
    const index = windowHostWindows.findIndex((entry) => entry.id === windowRecord.id);
    if (index < 0) {
      windowHostWindows = [...windowHostWindows, windowRecord];
      return;
    }

    if (isSameWindowRecord(windowHostWindows[index], windowRecord)) {
      return;
    }

    const next = [...windowHostWindows];
    next[index] = windowRecord;
    windowHostWindows = next;
  }

  function removeWindowRecord(windowId: string): void {
    const next = windowHostWindows.filter((windowRecord) => windowRecord.id !== windowId);
    if (next.length === windowHostWindows.length) {
      return;
    }

    windowHostWindows = next;
  }

  function createSingletonModalWindowRecord(windowId: string, title: string): WindowRecord {
    return createWindowRecord({
      id: windowId,
      kind: 'builtin',
      surfaceId: windowId,
      title,
      isModal: true,
      sizeToContent: true,
      placement: 'in-app',
      canBackdropDismiss: true,
      canEscapeDismiss: true,
      canPopOut: false,
      canMoveInApp: false,
    });
  }

  function createLoggingWindowRecord(): WindowRecord {
    return createWindowRecord({
      id: WINDOW_HOST_SINGLETON_IDS.loggingModal,
      kind: 'builtin',
      surfaceId: WINDOW_HOST_SINGLETON_IDS.loggingModal,
      title: 'session logging',
      isModal: true,
      sizeToContent: true,
      placement: 'in-app',
      canBackdropDismiss: true,
      canEscapeDismiss: true,
      canPopOut: false,
      canMoveInApp: false,
    });
  }

  function createWorldWindowRecord(title: string): WindowRecord {
    return createWindowRecord({
      id: WINDOW_HOST_SINGLETON_IDS.worldModal,
      kind: 'builtin',
      surfaceId: WINDOW_HOST_SINGLETON_IDS.worldModal,
      title,
      isModal: true,
      sizeToContent: true,
      placement: 'in-app',
      canBackdropDismiss: true,
      canEscapeDismiss: true,
      canPopOut: false,
      canMoveInApp: false,
    });
  }

  function createCharacterWindowRecord(title: string): WindowRecord {
    return createWindowRecord({
      id: WINDOW_HOST_SINGLETON_IDS.characterModal,
      kind: 'builtin',
      surfaceId: WINDOW_HOST_SINGLETON_IDS.characterModal,
      title,
      isModal: true,
      sizeToContent: true,
      placement: 'in-app',
      canBackdropDismiss: true,
      canEscapeDismiss: true,
      canPopOut: false,
      canMoveInApp: false,
    });
  }

  function handleEditorModalOpened(kind: 'world' | 'character', title: string): void {
    if (kind === 'world') {
      upsertWindowRecord(createWorldWindowRecord(title));
    } else {
      upsertWindowRecord(createCharacterWindowRecord(title));
    }
  }

  function handleEditorModalClosed(kind: 'world' | 'character'): void {
    removeWindowRecord(kind === 'world'
      ? WINDOW_HOST_SINGLETON_IDS.worldModal
      : WINDOW_HOST_SINGLETON_IDS.characterModal);
  }

  function getFuzzballStorageWindowState(windowId: string): FuzzballStorageViewerState {
    return fuzzballStorageWindowStates[windowId] ?? createFuzzballStorageViewerState('', '', '', 'fuzzball storage viewer');
  }

  function getTreeDataWindowRenderProps(windowId: string): TreeDataWindowRenderProps | null {
    const windowRecord = windowHostWindows.find((record) => record.id === windowId)
      ?? poppedOutWindowRecords[windowId]
      ?? null;

    if (!windowRecord) {
      return null;
    }

    if (windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.treeDataDemo) {
      return {
        model: createDemoTreeDataWindowModel(),
      };
    }

    if (windowRecord.surfaceId.startsWith('fuzzball-storage-window-')) {
      const sourceState = getFuzzballStorageWindowState(windowId);
      return {
        model: buildFuzzballStorageViewerModel(sourceState),
        onToggleNode: (nodeId) => handleFuzzballStorageTreeToggle(windowId, nodeId),
      };
    }

    return null;
  }

  function handleFuzzballStorageTreeToggle(windowId: string, nodeId: string): void {
    const sourceState = getFuzzballStorageWindowState(windowId);
    if (!sourceState.sourceTabId) {
      return;
    }

    const model = buildFuzzballStorageViewerModel(sourceState);
    const node = model.root;
    if (node.id !== nodeId || node.kind !== 'branch' || node.childrenState !== 'unknown') {
      return;
    }

    requestFuzzballStorageNodeLoad(sourceState, nodeId, session.worldSessionContainers);
  }

  function openDummyWindow(): void {
    const index = windowHostWindows.length;
    const id = `dummy-window-${nextWindowHostId++}`;

    windowHostWindows = [
      ...windowHostWindows,
      createWindowRecord({
        id,
        kind: 'builtin',
        surfaceId: WINDOW_HOST_SINGLETON_IDS.dummyWindow,
        title: `dummy window ${index + 1}`,
        isModal: false,
        placement: 'in-app',
        sizeToContent: false,
        size: {
          width: 560,
          height: 360,
        },
        position: {
          x: 120 + index * 28,
          y: 120 + index * 28,
        },
        canBackdropDismiss: false,
        canEscapeDismiss: false,
        canPopOut: true,
        canMoveInApp: true,
      }),
    ];
  }

  function openTreeDataWindow(): void {
    const index = windowHostWindows.length;
    const id = `tree-data-window-${nextWindowHostId++}`;

    windowHostWindows = [
      ...windowHostWindows,
      createWindowRecord({
        id,
        kind: 'builtin',
        surfaceId: WINDOW_HOST_SINGLETON_IDS.treeDataDemo,
        title: `tree data window ${index + 1}`,
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
      }),
    ];
  }

  function openFuzzballStorageWindow(
    sourceTabId: string,
    worldId: string,
    characterId: string,
    title: string,
    description?: string,
  ): void {
    if (!worldId) {
      return;
    }

    const index = windowHostWindows.length;
    const id = `fuzzball-storage-window-${nextWindowHostId++}`;

    fuzzballStorageWindowStates = {
      ...fuzzballStorageWindowStates,
      [id]: createFuzzballStorageViewerState(sourceTabId, worldId, characterId, title, description),
    };

    windowHostWindows = [
      ...windowHostWindows,
      createWindowRecord({
        id,
        kind: 'builtin',
        surfaceId: id,
        title,
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
      }),
    ];
  }

  function clearFuzzballStorageWindowState(windowId: string): void {
    if (!(windowId in fuzzballStorageWindowStates)) {
      return;
    }

    const { [windowId]: _removed, ...rest } = fuzzballStorageWindowStates;
    fuzzballStorageWindowStates = rest;
  }

  async function discardFuzzballStorageWindowsForSourceTab(sourceTabId: string): Promise<void> {
    const matchedWindowIds = Object.entries(fuzzballStorageWindowStates)
      .filter(([, state]) => state.sourceTabId === sourceTabId)
      .map(([windowId]) => windowId);

    if (matchedWindowIds.length === 0) {
      return;
    }

    const windowIdSet = new Set(matchedWindowIds);
    const poppedOutWindowIds = matchedWindowIds.filter((windowId) => windowId in poppedOutWindowRecords);

    fuzzballStorageWindowStates = Object.fromEntries(
      Object.entries(fuzzballStorageWindowStates).filter(([windowId]) => !windowIdSet.has(windowId)),
    );
    windowHostWindows = windowHostWindows.filter((windowRecord) => !windowIdSet.has(windowRecord.id));
    poppedOutWindowRecords = Object.fromEntries(
      Object.entries(poppedOutWindowRecords).filter(([windowId]) => !windowIdSet.has(windowId)),
    );

    await Promise.all(
      poppedOutWindowIds.map((windowId) =>
        invoke('window_host_discard', { windowId }).catch((error) => {
          console.error('failed to discard fuzzball storage window:', error);
        }),
      ),
    );
  }

  function closeWindow(windowId: string): void {
    clearFuzzballStorageWindowState(windowId);

    removeWindowRecord(windowId);
  }

  function activateWindow(windowId: string): void {
    const index = windowHostWindows.findIndex((windowRecord) => windowRecord.id === windowId);
    if (index < 0 || index === windowHostWindows.length - 1) {
      return;
    }

    const next = [...windowHostWindows];
    const [active] = next.splice(index, 1);
    next.push(active);
    windowHostWindows = next;
  }

  function moveWindow(windowId: string, position: WindowPoint): void {
    windowHostWindows = windowHostWindows.map((windowRecord) =>
      windowRecord.id === windowId ? { ...windowRecord, position } : windowRecord,
    );
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

  function restoreWindowRecordToHost(windowRecord: WindowRecord): void {
    windowHostWindows = [...windowHostWindows, windowRecord];
  }

  function handlePoppedOutWindowReturned(windowId: string): void {
    const windowRecord = removePoppedOutWindowRecord(windowId);
    if (!windowRecord) {
      console.log('[window-action] popped-out window return ignored', {
        windowId,
      });
      return;
    }

    console.log('[window-action] popped-out window returned to host', {
      windowId,
      title: windowRecord.title,
    });

    restoreWindowRecordToHost({
      ...windowRecord,
      placement: 'in-app',
    });
  }

  function handlePoppedOutWindowDiscarded(windowId: string): void {
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

    clearFuzzballStorageWindowState(windowId);
  }

  async function handlePopOutWindow(windowId: string): Promise<void> {
    const windowRecord = windowHostWindows.find((record) => record.id === windowId);
    if (!windowRecord || !windowRecord.canPopOut || windowRecord.placement !== 'in-app') {
      return;
    }

    const nextWindowRecord: WindowRecord = {
      ...windowRecord,
      placement: 'window',
    };

    try {
      windowHostWindows = windowHostWindows.filter((record) => record.id !== windowId);
      storePoppedOutWindowRecord(nextWindowRecord);
      await invoke('window_host_pop_out', {
        windowRecord: nextWindowRecord,
      });
    } catch (error) {
      restoreWindowRecordToHost(windowRecord);
      removePoppedOutWindowRecord(windowId);
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
    return windowHostWindows.some((windowRecord) => windowRecord.isModal);
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
      console.log('[window-action] app close prevented by blocking state');
      return;
    }

    if (!hasConnectedWorldTabs()) {
      console.log('[window-action] app close allowed without confirmation');
      return;
    }

    event.preventDefault();
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
    if (!hasConnectedWorldTabs()) {
      return;
    }

    try {
      const currentWindow = getCurrentWebviewWindow();
      if (!currentWindow) {
        return;
      }

      console.log('[window-action] app close confirm requested via native close');
      allowWindowCloseOnce = true;
      await currentWindow.close();
      console.log('[window-action] app close confirm native close completed');
    } catch (error) {
      allowWindowCloseOnce = false;
      console.error('failed to close the app window:', error);
    }
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

  onMount(() => {
    console.log('[window-action] app mount state', {
      isPoppedOutWindow,
      poppedOutWindowId,
      url: typeof window !== 'undefined' ? window.location.href : null,
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
        await appServices.lifecycle.runHooks('startup');
        session.setTranscriptScrollbackChunks($appSettingsStore.transcriptScrollbackChunks);
        if (disposed) {
          return;
        }

        await session.load();
        await tick();
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
          const unlistenPopIn = await listen<string>('window-host:pop-in-requested', (event) => {
            console.log('[window-event] popped-out window pop-in requested', {
              windowId: event.payload,
            });
            handlePoppedOutWindowReturned(event.payload);
          });
          const unlistenDiscarded = await listen<string>('window-host:discarded', (event) => {
            console.log('[window-event] popped-out window discarded', {
              windowId: event.payload,
            });
            handlePoppedOutWindowDiscarded(event.payload);
          });
          unlistenWindowHostEvents = [unlistenPopIn, unlistenDiscarded];
          if (disposed) {
            unlistenWindowHostEvents.forEach((unlisten) => unlisten());
            unlistenWindowHostEvents = [];
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
      if (!isPoppedOutWindow) {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
        window.removeEventListener('focus', handleWindowFocus);
        window.removeEventListener('keydown', handleKeyDown, { capture: true });
      }
      unlistenAppClose?.();
      unlistenAppClose = null;
      unlistenWindowHostEvents.forEach((unlisten) => unlisten());
      unlistenWindowHostEvents = [];
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
    onPopIn={(windowId) => void handlePopInWindow(windowId)}
  >
    {#if poppedOutWindowRecord?.surfaceId === WINDOW_HOST_SINGLETON_IDS.dummyWindow}
      <DummyWindowContent instanceLabel={poppedOutWindowRecord.title} />
    {:else if poppedOutWindowRecord?.surfaceId === WINDOW_HOST_SINGLETON_IDS.treeDataDemo
      || poppedOutWindowRecord?.surfaceId.startsWith('fuzzball-storage-window-')}
      {@const treeDataWindowProps = getTreeDataWindowRenderProps(poppedOutWindowRecord.id)}
      {#if treeDataWindowProps}
        <TreeDataWindow {...treeDataWindowProps} />
      {/if}
    {/if}
  </PoppedOutWindowView>
{:else}
<div id="app-shell">
  <TopBar
    tabs={$session.tabs}
    activeTabId={$session.activeTabId}
    worldSessions={$session.worldSessions}
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
      void session.togglePanel('notes');
    }}
    onOpenDebugConsoleTab={(tabId) => {
      session.activateWorldTab(tabId);
      void session.togglePanel('debugConsole');
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
        currentWorldName: worldSession.currentWorld?.name ?? 'fuzzball storage viewer',
        currentCharacterName: worldSession.currentCharacter?.name ?? null,
        scope: tab.id,
        activeBar: worldSession.activeBar,
        notes: worldSession.notes,
        onNotesInput: (notes) => session.saveNotes(notes),
        onSpellcheckIgnoreWord: (word) => void appServices.spellcheck.ignoreWord(word),
        onNotesClose: () => void session.togglePanel('notes'),
        onCloseNotesTab: () => void session.closePanel('notes'),
        onDebugConsoleClose: () => void session.togglePanel('debugConsole'),
        onCloseDebugConsoleTab: () => void session.closePanel('debugConsole'),
        onOpenFuzzballStorageViewer: () => {
          if (!worldSession.currentWorld) {
            return;
          }

          const currentWorldName = worldSession.currentWorld.name;
          const currentCharacterName = worldSession.currentCharacter?.name ?? null;
          const fuzzballStorageTitle = currentCharacterName
            ? `${currentWorldName} · ${currentCharacterName} storage`
            : `${currentWorldName} storage`;
          const fuzzballStorageDescription = currentCharacterName
            ? `world: ${currentWorldName} · character: ${currentCharacterName}`
            : `world: ${currentWorldName}`;

          openFuzzballStorageWindow(
            tab.id,
            worldSession.currentWorld.id,
            worldSession.currentCharacter?.id ?? '',
            fuzzballStorageTitle,
            fuzzballStorageDescription,
          );
        },
      })}
      {@const playScreenActions = createPlayScreenActions(tab, worldSession)}
      <PlayScreen
        scope={tab.id}
        visible={tab.id === $session.activeTabId}
        styleValues={$resolvedAppStyle}
        activeBar={worldSession.activeBar}
        connectionStatus={worldSession.connectionStatus}
        hasNewActivity={worldSession.hasNewActivity}
        bars={worldSession.inputBars}
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
  <AppNoticeHost open={true} title={$appNoticeStore.title} onClose={closeActiveNotice}>
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

<WindowHost
  open={windowHostWindows.length > 0}
  windows={windowHostWindows}
  onClose={closeWindow}
  onPopOut={(windowId) => void handlePopOutWindow(windowId)}
  onActivate={activateWindow}
  onMove={moveWindow}
  let:windowRecord
>
  {#if windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.dummyWindow}
    <DummyWindowContent instanceLabel={windowRecord.title} />
  {:else if windowRecord.surfaceId === WINDOW_HOST_SINGLETON_IDS.treeDataDemo
    || windowRecord.surfaceId.startsWith('fuzzball-storage-window-')}
    {@const treeDataWindowProps = getTreeDataWindowRenderProps(windowRecord.id)}
    {#if treeDataWindowProps}
      <TreeDataWindow {...treeDataWindowProps} />
    {/if}
  {/if}
</WindowHost>

{/if}
