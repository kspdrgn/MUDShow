import type { DebugConsoleEntry } from './debug-console';

export interface WorldSessionDebugConsole {
  entries: DebugConsoleEntry[];
  sourceLabel: string | null;
}

export function createWorldSessionDebugConsole(sourceLabel: string | null = null): WorldSessionDebugConsole {
  return {
    entries: [],
    sourceLabel,
  };
}
