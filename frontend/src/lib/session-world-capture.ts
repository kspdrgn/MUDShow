import { captureFuzzballWorldLine } from './fuzzball/capture';
import type { WorldTabSessionState } from './world-session';

interface WorldCaptureActionContext {
  getWorldSession: (tabId: string) => WorldTabSessionState;
}

export function createWorldCaptureActions({ getWorldSession }: WorldCaptureActionContext) {
  function captureIncomingWorldLine(tabId: string, text: string): void {
    const session = getWorldSession(tabId);
    const world = session.currentWorld;

    if (!world || world.compatibility !== 'fuzzball') {
      return;
    }

    captureFuzzballWorldLine(world.id, session.currentCharacter?.id ?? '', text);
  }

  return {
    captureIncomingWorldLine,
  };
}
