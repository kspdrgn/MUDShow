import type { SurfaceTransportSession } from '../../surfaces/surface-transport';
import type { DebugConsoleEntry } from '../../debug-console';

export interface DebugConsoleWindowModel {
  title: string;
  description?: string;
  sourceLabel: string | null;
  entries: DebugConsoleEntry[];
}

export type DebugConsoleWindowCommand = { type: 'closeRequested' };

export interface DebugConsoleWindowSnapshot {
  model: DebugConsoleWindowModel;
}

export type DebugConsoleWindowTransportSession = SurfaceTransportSession<
  DebugConsoleWindowCommand,
  DebugConsoleWindowSnapshot
>;
