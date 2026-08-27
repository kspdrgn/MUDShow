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
  currentWorldName: string;
  currentCharacterName: string | null;
  showFuzzballStorageViewer: boolean;
  scope: string;
  activeBar: InputBarId;
  onOpenFuzzballStorageViewer: () => void;
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
    const controls: ChannelBarControlVM[] = context.showFuzzballStorageViewer
      ? [{
          id: 'fuzzball-storage-viewer',
          label: 'exa me=/',
          title: context.currentCharacterName
            ? `world: ${context.currentWorldName} · character: ${context.currentCharacterName}`
            : `world: ${context.currentWorldName}`,
          onClick: context.onOpenFuzzballStorageViewer,
        }]
      : [];

    return {
      tabs: [],
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

  return {
    handleOutputScroll,
    handleOutputScrollKey,
    handleScrollToBottom,
    getWorldChannelsViewModel,
  };
}

export const createWorldPanelActions = createWorldChannelActions;
