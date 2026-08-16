import type { DebugConsoleEntry } from './debug-console';

export interface WorldSessionDebugConsole {
  entries: DebugConsoleEntry[];
  visible: boolean;
  registered: boolean;
  sourceLabel: string | null;
}

export function createWorldSessionDebugConsole(sourceLabel: string | null = null): WorldSessionDebugConsole {
  return {
    entries: [],
    visible: false,
    registered: false,
    sourceLabel,
  };
}
