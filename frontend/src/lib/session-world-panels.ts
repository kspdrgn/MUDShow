import { focusElement, nextFrame, scrollElementBy, scrollElementToBottom, scrollElementToTop } from './session-dom';
import type { WorldTabSessionState } from './world-session';
import {
  getWorldDomScope,
  getWorldHighlightInputId,
  getWorldInputBarInputId,
  getWorldNotesEditorId,
  getWorldOutputAreaId,
  getWorldRuleInputId,
} from './world-dom';
import { flushPendingNotesSave } from './session-world-input';
import { loadNotes } from './storage';

interface WorldPanelActionContext {
  getActiveWorldTabId: () => string | null;
  resolveActiveWorldScope: () => string | null;
  getWorldSession: (tabId: string) => WorldTabSessionState;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
}

export function createWorldPanelActions({
  getActiveWorldTabId,
  resolveActiveWorldScope,
  getWorldSession,
  updateWorldSession,
}: WorldPanelActionContext) {
  let suppressTranscriptScrollState = false;

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

  async function togglePanel(panel: 'notes' | 'highlights' | 'rules' | 'debugConsole'): Promise<void> {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    const session = getWorldSession(tabId);
    const shouldOpen =
      panel === 'notes'
        ? !session.notesVisible
        : panel === 'highlights'
          ? !session.highlightsVisible
          : panel === 'rules'
            ? !session.rulesVisible
            : !session.debugConsoleVisible;
    const shouldPreserveBottom = !session.userScrolled;

    if (panel === 'notes') {
      if (session.notesVisible && !shouldOpen) {
        flushPendingNotesSave(tabId);
      }

      if (shouldOpen && session.currentCharacter && session.notes === '') {
        const loadedNotes = await loadNotes(session.currentCharacter.id, false);
        updateWorldSession(tabId, { notes: loadedNotes });
      }

      updateWorldSession(tabId, {
        notesVisible: shouldOpen,
        notesRegistered: shouldOpen ? true : session.notesRegistered,
        highlightsVisible: false,
        rulesVisible: false,
        debugConsoleVisible: false,
      });
    } else if (panel === 'highlights') {
      updateWorldSession(tabId, {
        highlightsVisible: shouldOpen,
        notesVisible: false,
        rulesVisible: false,
        debugConsoleVisible: false,
      });
    } else if (panel === 'rules') {
      updateWorldSession(tabId, {
        rulesVisible: shouldOpen,
        notesVisible: false,
        highlightsVisible: false,
        debugConsoleVisible: false,
      });
    } else {
      updateWorldSession(tabId, {
        debugConsoleVisible: shouldOpen,
        debugConsoleRegistered: shouldOpen ? true : session.debugConsoleRegistered,
        notesVisible: false,
        highlightsVisible: false,
        rulesVisible: false,
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
        const scope = resolveActiveWorldScope();
        if (scope) {
          focusElement(
            panel === 'notes'
              ? getWorldNotesEditorId(scope)
              : panel === 'highlights'
                ? getWorldHighlightInputId(scope)
                : panel === 'rules'
                  ? getWorldRuleInputId(scope)
                  : getWorldInputBarInputId(getWorldDomScope(tabId), session.activeBar),
            true,
          );
        }
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
    const shouldFocusInput = panel === 'notes' ? session.notesVisible : session.debugConsoleVisible;

    if (panel === 'notes') {
      flushPendingNotesSave(tabId);
      updateWorldSession(tabId, {
        notesVisible: false,
        notesRegistered: false,
      });
    } else {
      updateWorldSession(tabId, {
        debugConsoleVisible: false,
        debugConsoleRegistered: false,
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
