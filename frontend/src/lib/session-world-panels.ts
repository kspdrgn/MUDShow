import { focusElement, nextFrame, scrollElementBy, scrollElementToBottom, scrollElementToTop } from './session-dom';
import type { WorldTabSessionState } from './world-session';
import type { WorldSessionContainerRegistry } from './world-session-container';
import type { WorldSessionKey } from './world-session-registry';
import {
  getWorldDomScope,
  getWorldInputBarInputId,
  getWorldOutputAreaId,
} from './world-dom';
import { flushPendingNotesSave } from './session-world-input';

interface WorldPanelActionContext {
  getActiveWorldTabId: () => string | null;
  resolveActiveWorldScope: () => string | null;
  getWorldSession: (tabId: string) => WorldTabSessionState;
  getWorldSessionKeyForTab: (tabId: string) => WorldSessionKey | null;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
  worldSessionContainers: WorldSessionContainerRegistry;
}

export function createWorldPanelActions({
  getActiveWorldTabId,
  resolveActiveWorldScope,
  getWorldSession,
  getWorldSessionKeyForTab,
  updateWorldSession,
  worldSessionContainers,
}: WorldPanelActionContext) {
  let suppressTranscriptScrollState = false;

  function getDebugConsole(tabId: string) {
    const sessionKey = getWorldSessionKeyForTab(tabId);
    return sessionKey ? worldSessionContainers.debugConsole.ensure(sessionKey) : null;
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
  };
}
