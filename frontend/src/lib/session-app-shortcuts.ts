import { type SessionState } from './session-state';
import type { WorldTabSessionState } from './world-session';

interface AppShortcutActionContext {
  getState: () => SessionState;
  patch: (patch: Partial<SessionState>) => void;
  getActiveWorldTabId: () => string | null;
  closeTab: (tabId: string, source?: 'mouse' | 'shortcut') => void;
  closeModal: () => void;
  handleWorldShortcutKeyDown: (event: KeyboardEvent) => boolean;
}

export function createAppShortcutActions({
  getState,
  patch,
  getActiveWorldTabId,
  closeTab,
  closeModal,
  handleWorldShortcutKeyDown,
}: AppShortcutActionContext) {
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
        closeModal();
      }
      return;
    }

    if (event.ctrlKey && event.key === 'F4') {
      event.preventDefault();

      const activeTabId = state.activeTabId;
      if (activeTabId !== null) {
        closeModal();
        closeTab(activeTabId, 'shortcut');
      }

      return;
    }

    const activeWorldTabId = getActiveWorldTabId();
    if (activeWorldTabId === null) {
      return;
    }

    if (handleWorldShortcutKeyDown(event)) {
      return;
    }
  }

  return {
    handleGlobalKeyDown,
  };
}
