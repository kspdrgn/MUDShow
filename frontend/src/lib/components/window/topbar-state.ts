import type { AppTab } from '../../tabs';
import type { WorldTabSessionState } from '../../world-session';

export interface WorldContextMenuState {
  tab: AppTab | null;
  session: WorldTabSessionState | null;
  canReconnect: boolean;
  canDisconnect: boolean;
  canQuickLog: boolean;
  canStopLogging: boolean;
  canEditWorld: boolean;
  canEditCharacter: boolean;
}

export interface CloseConfirmState {
  tab: AppTab | null;
  session: WorldTabSessionState | null;
  worldName: string;
  message: string;
  actionLabel: string;
  isOpen: boolean;
}

export function shouldStartTitlebarDrag(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return target.closest(
    '.world-tab-group, .titlebar-quick-connect, .titlebar-dropdown, #titlebar-actions, button, input, textarea, select, a',
  ) === null;
}

export function getQuickConnectSide(availableRight: number, dropdownWidth = 420): 'left' | 'right' {
  return availableRight >= dropdownWidth + 12 ? 'right' : 'left';
}

export function getWorldContextMenuState(
  worldContextMenuTabId: string | null,
  tabs: AppTab[],
  worldSessions: Record<string, WorldTabSessionState>,
): WorldContextMenuState {
  const tab = worldContextMenuTabId ? tabs.find((entry) => entry.id === worldContextMenuTabId) ?? null : null;
  const session = tab?.kind === 'world' ? worldSessions[tab.id] ?? null : null;

  return {
    tab,
    session,
    canReconnect:
      tab?.kind === 'world' &&
      session !== null &&
      session.connectionStatus === 'disconnected' &&
      session.currentWorld !== null,
    canDisconnect:
      tab?.kind === 'world' &&
      session !== null &&
      (session.connectionStatus === 'connecting' || session.connectionStatus === 'connected'),
    canQuickLog: tab?.kind === 'world' && session !== null && !session.loggingActive,
    canStopLogging: tab?.kind === 'world' && session !== null && session.loggingActive,
    canEditWorld: tab?.kind === 'world' && session !== null && session.currentWorld !== null,
    canEditCharacter: tab?.kind === 'world' && session !== null && session.currentCharacter !== null,
  };
}

export function getCloseConfirmState(
  closeConfirmTabId: string | null,
  closeConfirmMode: 'modal' | 'dropdown' | null,
  tabs: AppTab[],
  worldSessions: Record<string, WorldTabSessionState>,
  confirmUnloggedTabClose: boolean,
): CloseConfirmState {
  const tab = closeConfirmTabId ? tabs.find((entry) => entry.id === closeConfirmTabId) ?? null : null;
  const session = closeConfirmTabId && tab?.kind === 'world' ? worldSessions[closeConfirmTabId] ?? null : null;
  const isOpen = closeConfirmMode === 'dropdown' && tab !== null;
  const worldName = closeConfirmTabId
    ? session?.currentWorld?.name ?? session?.currentCharacter?.name ?? tab?.title ?? 'this world'
    : '';
  const connected = session?.connectionStatus === 'connected' || session?.connectionStatus === 'connecting';

  return {
    tab,
    session,
    worldName,
    message: connected
      ? `World ${worldName} is connected. Disconnect and close?`
      : confirmUnloggedTabClose && session !== null
        ? `World ${worldName} is not being logged. Close anyway?`
        : '',
    actionLabel: connected
      ? 'disconnect and close'
      : confirmUnloggedTabClose && session !== null
        ? 'close anyway'
        : 'disconnect and close',
    isOpen,
  };
}
