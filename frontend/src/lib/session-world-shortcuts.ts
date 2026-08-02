import { focusElement } from './session-dom';
import type { InputBarId } from './input-bars';
import type { WorldTabSessionState } from './world-session';
import {
  getWorldDomScope,
  getWorldInputBarContainerId,
  getWorldInputBarInputId,
} from './world-dom';

interface WorldShortcutActionContext {
  getActiveWorldTabId: () => string | null;
  getWorldSession: (tabId: string) => WorldTabSessionState;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
  addInputBarAfter: (barId: InputBarId) => Promise<void>;
  togglePanel: (panel: 'notes' | 'highlights' | 'rules' | 'debugConsole') => Promise<void>;
}

export function createWorldShortcutActions({
  getActiveWorldTabId,
  getWorldSession,
  updateWorldSession,
  addInputBarAfter,
  togglePanel,
}: WorldShortcutActionContext) {
  function handleWorldShortcutKeyDown(event: KeyboardEvent): boolean {
    const activeWorldTabId = getActiveWorldTabId();
    if (activeWorldTabId === null) {
      return false;
    }

    const session = getWorldSession(activeWorldTabId);

    if (event.ctrlKey && event.key === 'F2') {
      event.preventDefault();

      const secondBar = session.inputBars[1];
      if (!secondBar) {
        return true;
      }

      const scope = getWorldDomScope(activeWorldTabId);
      const container = document.getElementById(getWorldInputBarContainerId(scope, secondBar.id));
      const closeButton = container?.querySelector<HTMLButtonElement>('[aria-label="close input bar"]');
      closeButton?.click();
      return true;
    }

    if (event.key === 'F1' || event.key === 'F2') {
      event.preventDefault();
      const hotkeyBar = session.inputBars.find((bar) => bar.label === event.key);

      if (hotkeyBar) {
        updateWorldSession(activeWorldTabId, { activeBar: hotkeyBar.id });
        const scope = getWorldDomScope(activeWorldTabId);
        focusElement(getWorldInputBarInputId(scope, hotkeyBar.id));
        return true;
      }

      if (event.key === 'F2' && session.inputBars.length === 1) {
        void addInputBarAfter(session.inputBars[0].id);
      }

      return true;
    }

    if (event.key === 'F3') {
      event.preventDefault();
      void togglePanel('notes');
      return true;
    }

    return false;
  }

  return {
    handleWorldShortcutKeyDown,
  };
}
