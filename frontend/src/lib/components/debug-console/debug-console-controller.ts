import type { DebugConsoleWindowModel } from './debug-console-transport';
import type { WorldSessionDebugConsole } from '../../world-session-debug-console';

export function buildDebugConsoleWindowModel(
  debugConsole: WorldSessionDebugConsole,
  title: string,
  description?: string,
): DebugConsoleWindowModel {
  return {
    title,
    description,
    sourceLabel: debugConsole.sourceLabel,
    entries: debugConsole.entries,
  };
}

export function createDebugConsoleWindowPlaceholderModel(title: string): DebugConsoleWindowModel {
  return {
    title,
    description: 'waiting for surface data',
    sourceLabel: null,
    entries: [],
  };
}
