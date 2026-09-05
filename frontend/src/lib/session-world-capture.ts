import type { WorldTabSessionState } from './world-session';
import type { WorldPluginSession } from './world-plugin-registry';

interface WorldCaptureActionContext {
  getWorldSession: (tabId: string) => WorldTabSessionState;
  getWorldPluginSession: (tabId: string) => WorldPluginSession | null;
}

export function createWorldCaptureActions({ getWorldSession, getWorldPluginSession }: WorldCaptureActionContext) {
  function captureIncomingWorldLine(tabId: string, text: string): void {
    const session = getWorldSession(tabId);
    if (!session.currentWorld) {
      return;
    }

    getWorldPluginSession(tabId)?.handleIncomingLine(text);
  }

  return {
    captureIncomingWorldLine,
  };
}
