import type { InputBarId } from './input-bars';
import { createInputBars, type InputBarConfig } from './input-bars';
import { PlayTranscript, type TranscriptHistoryEntry, RenderCache } from './playback';
import type { CharacterRecord, WorldRecord } from './types';
import type { ConnectionStatus, DisconnectReason } from './session-state';

export interface WorldSessionProjection {
  currentWorld: WorldRecord | null;
  currentCharacter: CharacterRecord | null;
  inputBars: InputBarConfig[];
  outputRevision: number;
  userScrolled: boolean;
  activeBar: InputBarId;
  notesVisible: boolean;
  highlightsVisible: boolean;
  rulesVisible: boolean;
  connectionStatus: ConnectionStatus;
  disconnectReason: DisconnectReason;
  hasNewActivity: boolean;
  notes: string;
  loggingActive: boolean;
  logFilePath: string | null;
  logFolderPath: string | null;
  logError: string | null;
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
    notesVisible: false,
    highlightsVisible: false,
    rulesVisible: false,
    connectionStatus: 'idle',
    disconnectReason: null,
    hasNewActivity: false,
    notes: '',
    loggingActive: false,
    logFilePath: null,
    logFolderPath: null,
    logError: null,
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
    notesVisible: session.notesVisible,
    highlightsVisible: session.highlightsVisible,
    rulesVisible: session.rulesVisible,
    connectionStatus: session.connectionStatus,
    disconnectReason: session.disconnectReason,
    hasNewActivity: session.hasNewActivity,
    notes: session.notes,
    loggingActive: session.loggingActive,
    logFilePath: session.logFilePath,
    logFolderPath: session.logFolderPath,
    logError: session.logError,
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
