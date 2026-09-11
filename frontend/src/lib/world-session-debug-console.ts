import type { DebugConsoleEntry } from './debug-console.js';

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
