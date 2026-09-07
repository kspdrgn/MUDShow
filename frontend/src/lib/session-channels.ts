import { focusElement, nextFrame, scrollElementBy, scrollElementToBottom, scrollElementToTop } from './session-dom';
import type { InputBarId } from './input-bars';
import type { ChannelBarControlVM, ChannelTabVM } from './components/play/channel';
import type { WorldTabSessionState } from './world-session';
import {
  getWorldDomScope,
  getWorldInputBarInputId,
  getWorldOutputAreaId,
} from './world-dom';

interface WorldChannelActionContext {
  getActiveWorldTabId: () => string | null;
  resolveActiveWorldScope: () => string | null;
  updateWorldSession: (tabId: string, patch: Partial<WorldTabSessionState>) => void;
}

export interface WorldChannelViewContext {
  controls: ChannelBarControlVM[];
  scope: string;
  activeBar: InputBarId;
}

export interface WorldChannelsViewModel {
  tabs: ChannelTabVM[];
  controls: ChannelBarControlVM[];
}

export function createWorldChannelActions({
  getActiveWorldTabId,
  resolveActiveWorldScope,
  updateWorldSession,
}: WorldChannelActionContext) {
  let suppressTranscriptScrollState = false;

  function getWorldChannelsViewModel(_tabId: string, context: WorldChannelViewContext): WorldChannelsViewModel {
    return {
      tabs: [],
      controls: context.controls,
    };
  }

  function updateOutputScrollState(tabId: string, outputEl: HTMLElement): void {
    const distance = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight;
    updateWorldSession(tabId, { userScrolled: distance > 2 });
  }

  function dismissLastActivityMarker(tabId: string): void {
    updateWorldSession(tabId, { lastActivityMarker: null });
  }

  function handleOutputScroll(userInitiated = false): void {
    if (!userInitiated) {
      return;
    }

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

    dismissLastActivityMarker(tabId);
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
      dismissLastActivityMarker(tabId);
      scrollElementToTop(getWorldOutputAreaId(scope));
      updateOutputScrollState(tabId, outputEl);
      return;
    }

    if (action === 'bottom') {
      dismissLastActivityMarker(tabId);
      scrollElementToBottom(getWorldOutputAreaId(scope));
      // Ctrl+End/Page-end is an explicit request to resume following output;
      // do not depend on a possibly stale virtualized scrollHeight reading to
      // decide whether split view should collapse.
      updateWorldSession(tabId, { userScrolled: false });
      return;
    }

    if (action === 'page-up') {
      dismissLastActivityMarker(tabId);
      scrollElementBy(getWorldOutputAreaId(scope), -outputEl.clientHeight);
      updateOutputScrollState(tabId, outputEl);
      return;
    }

    if (action === 'page-down') {
      dismissLastActivityMarker(tabId);
      scrollElementBy(getWorldOutputAreaId(scope), outputEl.clientHeight);
      updateOutputScrollState(tabId, outputEl);
    }
  }

  function handleScrollToBottom(): void {
    const tabId = getActiveWorldTabId();
    if (!tabId) {
      return;
    }

    dismissLastActivityMarker(tabId);
    updateWorldSession(tabId, { userScrolled: false });
    const scope = getWorldDomScope(tabId);
    void nextFrame().then(() => {
      scrollElementToBottom(getWorldOutputAreaId(scope));
    });
  }

  return {
    handleOutputScroll,
    handleOutputScrollKey,
    handleScrollToBottom,
    getWorldChannelsViewModel,
  };
}

export const createWorldPanelActions = createWorldChannelActions;
