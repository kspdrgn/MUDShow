import { focusElement, nextFrame, scrollElementBy, scrollElementToBottom, scrollElementToTop } from './session-dom';
import { appServices } from './app-services';
import { type InputBarId } from './input-bars';
import type { DebugConsoleEntry } from './debug-console';
import DebugConsolePanel from './components/play/DebugConsolePanel.svelte';
import NotesPanel from './components/play/NotesPanel.svelte';
import type { ChannelBarControlVM, ChannelTabVM } from './components/play/channel';
import type { WorldTabSessionState } from './world-session';
import type { WorldSessionContainerRegistry } from './world-session-container';
import type { WorldSessionKey } from './world-session-registry';
import {
  getWorldDomScope,
  getWorldInputBarInputId,
  getWorldOutputAreaId,
} from './world-dom';
import { flushPendingNotesSave } from './session-world-input';

interface WorldChannelActionContext {
  getActiveWorldTabId: () => string | null;
  resolveActiveWorldScope: () => string | null;
  getWorldSession: (tabId: string) => WorldTabSessionState;
  getWorldSessionKeyForTab: (tabId: string) => WorldSessionKey | null;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
  worldSessionContainers: WorldSessionContainerRegistry;
}

export interface WorldChannelViewContext {
  currentWorldName: string;
  currentCharacterName: string | null;
  scope: string;
  activeBar: InputBarId;
  notes: string;
  onNotesInput: (notes: string) => void;
  onSpellcheckIgnoreWord: (word: string) => void;
  onNotesClose: () => void;
  onCloseNotesTab: () => void;
  onDebugConsoleClose: () => void;
  onCloseDebugConsoleTab: () => void;
  onOpenFuzzballStorageViewer: () => void;
}

export interface WorldChannelState {
  notesVisible: boolean;
  notesRegistered: boolean;
  debugConsoleVisible: boolean;
  debugConsoleRegistered: boolean;
  debugConsoleEntries: DebugConsoleEntry[];
}

export interface WorldChannelsViewModel {
  tabs: ChannelTabVM[];
  controls: ChannelBarControlVM[];
}

export function createWorldChannelActions({
  getActiveWorldTabId,
  resolveActiveWorldScope,
  getWorldSession,
  getWorldSessionKeyForTab,
  updateWorldSession,
  worldSessionContainers,
}: WorldChannelActionContext) {
  let suppressTranscriptScrollState = false;

  function getDebugConsole(tabId: string) {
    const sessionKey = getWorldSessionKeyForTab(tabId);
    return sessionKey ? worldSessionContainers.debugConsole.ensure(sessionKey) : null;
  }

  function getWorldChannelState(tabId: string): WorldChannelState {
    const session = getWorldSession(tabId);
    const debugConsole = getDebugConsole(tabId);

    return {
      notesVisible: session.notesVisible,
      notesRegistered: session.notesRegistered,
      debugConsoleVisible: debugConsole?.visible ?? false,
      debugConsoleRegistered: debugConsole?.registered ?? false,
      debugConsoleEntries: debugConsole?.entries ?? [],
    };
  }

  function getWorldChannelsViewModel(tabId: string, context: WorldChannelViewContext): WorldChannelsViewModel {
    const state = getWorldChannelState(tabId);
    const spellcheckSettings = appServices.spellcheck.getConfig();

    const tabs: ChannelTabVM[] = [
      ...(state.notesRegistered || state.notesVisible
        ? [
            {
              id: 'notes',
              label: 'notes',
              open: state.notesVisible,
              panelComponent: NotesPanel,
              panelProps: {
                embedded: true,
                notes: context.notes,
                scope: context.scope,
                spellcheckEnabled: spellcheckSettings.enabled,
                spellcheckLanguage: spellcheckSettings.language,
                spellcheckIgnoredWords: spellcheckSettings.ignoredWords,
                spellcheckSuggestionLimit: spellcheckSettings.suggestionLimit,
                spellcheckMinimumWordLength: spellcheckSettings.minimumWordLength,
                spellcheckDebounceMs: spellcheckSettings.debounceMs,
                onInput: context.onNotesInput,
                onIgnoreWord: context.onSpellcheckIgnoreWord,
                onClose: context.onNotesClose,
              },
              onClose: context.onCloseNotesTab,
            },
          ]
        : []),
      ...(state.debugConsoleRegistered || state.debugConsoleVisible
        ? [
            {
              id: 'debug-console',
              label: 'debug console',
              open: state.debugConsoleVisible,
              panelComponent: DebugConsolePanel,
              panelProps: {
                embedded: true,
                entries: state.debugConsoleEntries,
                scope: context.scope,
                activeBar: context.activeBar,
                onClose: context.onDebugConsoleClose,
              },
              onClose: context.onCloseDebugConsoleTab,
            },
          ]
        : []),
    ] satisfies ChannelTabVM[];

    const controls: ChannelBarControlVM[] = [
      {
        id: 'fuzzball-storage-viewer',
        label: context.currentCharacterName
          ? `${context.currentWorldName} · ${context.currentCharacterName} storage`
          : `${context.currentWorldName} storage`,
        title: context.currentCharacterName
          ? `world: ${context.currentWorldName} · character: ${context.currentCharacterName}`
          : `world: ${context.currentWorldName}`,
        onClick: context.onOpenFuzzballStorageViewer,
      },
    ];

    return {
      tabs,
      controls,
    };
  }

  function updateOutputScrollState(tabId: string, outputEl: HTMLElement): void {
    const distance = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
    updateWorldSession(tabId, { userScrolled: distance > 2 });
  }

  function handleOutputScroll(): void {
    if (suppressTranscriptScrollState) {
      return;
    }

    const scope = resolveActiveWorldScope();
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

    const scope = resolveActiveWorldScope();
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

  async function togglePanel(panel: 'notes' | 'debugConsole'): Promise<void> {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const session = getWorldSession(tabId);
    const debugConsole = getDebugConsole(tabId);
    const shouldOpen = panel === 'notes'
      ? !session.notesVisible
      : !(debugConsole?.visible ?? false);
    const shouldPreserveBottom = !session.userScrolled;

    if (panel === 'notes') {
      if (session.notesVisible && !shouldOpen) {
        flushPendingNotesSave(tabId);
      }

      if (debugConsole) {
        debugConsole.visible = false;
      }

      updateWorldSession(tabId, {
        notesVisible: shouldOpen,
        notesRegistered: shouldOpen ? true : session.notesRegistered,
        debugConsoleRevision: debugConsole ? session.debugConsoleRevision + 1 : session.debugConsoleRevision,
      });
    } else {
      if (debugConsole) {
        debugConsole.visible = shouldOpen;
        if (shouldOpen) {
          debugConsole.registered = true;
        }
      }

      updateWorldSession(tabId, {
        notesVisible: false,
        debugConsoleRevision: session.debugConsoleRevision + 1,
      });
    }

    suppressTranscriptScrollState = true;
    try {
      await nextFrame();

      if (shouldPreserveBottom) {
        const scope = resolveActiveWorldScope();
        if (scope) {
          scrollElementToBottom(getWorldOutputAreaId(scope));
        }
      }

      await nextFrame();

      if (shouldOpen) {
        focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), session.activeBar), true);
      } else {
        focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), session.activeBar));
      }
    } finally {
      suppressTranscriptScrollState = false;
    }
  }

  async function closePanel(panel: 'notes' | 'debugConsole'): Promise<void> {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const session = getWorldSession(tabId);
    const debugConsole = getDebugConsole(tabId);
    const shouldFocusInput = panel === 'notes' ? session.notesVisible : debugConsole?.visible ?? false;

    if (panel === 'notes') {
      flushPendingNotesSave(tabId);
      updateWorldSession(tabId, {
        notesVisible: false,
        notesRegistered: false,
      });
    } else {
      if (debugConsole) {
        debugConsole.visible = false;
        debugConsole.registered = false;
      }

      updateWorldSession(tabId, {
        debugConsoleRevision: session.debugConsoleRevision + 1,
      });
    }

    if (!shouldFocusInput) {
      return;
    }

    await nextFrame();
    focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), session.activeBar), true);
  }

  return {
    handleOutputScroll,
    handleOutputScrollKey,
    handleScrollToBottom,
    togglePanel,
    closePanel,
    getWorldChannelState,
    getWorldChannelsViewModel,
  };
}

export const createWorldPanelActions = createWorldChannelActions;
