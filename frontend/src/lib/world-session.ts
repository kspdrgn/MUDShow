import type { InputBarId } from './input-bars';
import { createInputBars, type InputBarConfig } from './input-bars';
import { PlayTranscript, type TranscriptHistoryEntry, RenderCache } from './playback';
import type { CharacterRecord, WorldRecord } from './types';
import type { ConnectionStatus, DisconnectReason } from './session-state';
import type { LastActivityMarker } from './transcript-indicators';

export interface WorldConnectionDiagnostics {
  runtimeId: string | null;
  connectionId: string | null;
  sessionId: number | null;
  lastSequence: number;
  snapshotRevision: number;
  structuredSync: 'unknown' | 'current' | 'stale' | 'failed';
  lastError: string | null;
}

export interface WorldSessionProjection {
  currentWorld: WorldRecord | null;
  currentCharacter: CharacterRecord | null;
  inputBars: InputBarConfig[];
  outputRevision: number;
  userScrolled: boolean;
  activeBar: InputBarId;
  rulesVisible: boolean;
  connectionStatus: ConnectionStatus;
  disconnectReason: DisconnectReason;
  hasNewActivity: boolean;
  lastActivityMarker: LastActivityMarker | null;
  loggingActive: boolean;
  logFilePath: string | null;
  logFolderPath: string | null;
  logError: string | null;
  connectionDiagnostics: WorldConnectionDiagnostics;
}

export interface WorldTabSessionState extends WorldSessionProjection {
  transcript: PlayTranscript;
  transcriptHistory: TranscriptHistoryEntry[];
  renderCache: RenderCache; // Hot render cache for visible output
}

export function createWorldTabSessionState(transcriptMaxChunks?: number): WorldTabSessionState {
  return {
    currentWorld: null,
    currentCharacter: null,
    inputBars: createInputBars(1),
    outputRevision: 0,
    userScrolled: false,
    activeBar: 1,
    rulesVisible: false,
    connectionStatus: 'idle',
    disconnectReason: null,
    hasNewActivity: false,
    lastActivityMarker: null,
    loggingActive: false,
    logFilePath: null,
    logFolderPath: null,
    logError: null,
    connectionDiagnostics: {
      runtimeId: null,
      connectionId: null,
      sessionId: null,
      lastSequence: 0,
      snapshotRevision: 0,
      structuredSync: 'unknown',
      lastError: null,
    },
    transcript: new PlayTranscript(transcriptMaxChunks),
    transcriptHistory: [],
    renderCache: new RenderCache(1000), // Cache last 1000 rendered entries
  };
}

export function extractWorldProjection(session: WorldTabSessionState): WorldSessionProjection {
  return {
    currentWorld: session.currentWorld,
    currentCharacter: session.currentCharacter,
    inputBars: session.inputBars,
    outputRevision: session.outputRevision,
    userScrolled: session.userScrolled,
    activeBar: session.activeBar,
    rulesVisible: session.rulesVisible,
    connectionStatus: session.connectionStatus,
    disconnectReason: session.disconnectReason,
    hasNewActivity: session.hasNewActivity,
    lastActivityMarker: session.lastActivityMarker,
    loggingActive: session.loggingActive,
    logFilePath: session.logFilePath,
    logFolderPath: session.logFolderPath,
    logError: session.logError,
    connectionDiagnostics: session.connectionDiagnostics,
  };
}

export function applyWorldProjection(
  session: WorldTabSessionState,
  projection: Partial<WorldTabSessionState>,
): WorldTabSessionState {
  return {
    ...session,
    ...projection,
  };
}
