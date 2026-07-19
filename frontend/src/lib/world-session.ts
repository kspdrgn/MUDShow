import type { InputBarId } from './input-bars';
import { createInputBars, type InputBarConfig } from './input-bars';
import { PlayTranscript, type TranscriptHistoryEntry } from './playback';
import type { CharacterRecord, RuleDraft, WorldRecord } from './types';
import type { ConnectionStatus, DisconnectReason } from './session-state';

export interface WorldSessionProjection {
  currentWorld: WorldRecord | null;
  currentCharacter: CharacterRecord | null;
  inputBars: InputBarConfig[];
  outputChunks: string[];
  outputEndsWithBr: boolean;
  outputRevision: number;
  userScrolled: boolean;
  activeBar: InputBarId;
  notesVisible: boolean;
  highlightsVisible: boolean;
  rulesVisible: boolean;
  ruleModalOpen: boolean;
  ruleModalEditingIndex: number | null;
  ruleModalDraft: RuleDraft;
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
}

export function createWorldTabSessionState(): WorldTabSessionState {
  return {
    currentWorld: null,
    currentCharacter: null,
    inputBars: createInputBars(1),
    outputChunks: [],
    outputEndsWithBr: true,
    outputRevision: 0,
    userScrolled: false,
    activeBar: 1,
    notesVisible: false,
    highlightsVisible: false,
    rulesVisible: false,
    ruleModalOpen: false,
    ruleModalEditingIndex: null,
    ruleModalDraft: {
      label: '',
      pattern: '',
      foregroundColor: '#f1c40f',
      foregroundColorEnabled: true,
      backgroundColor: '#000000',
      backgroundColorEnabled: true,
      opacity: 1,
      opacityEnabled: true,
      wholeLine: false,
      caseSensitive: false,
      sampleText: 'sample text to test the rule',
    },
    connectionStatus: 'idle',
    disconnectReason: null,
    hasNewActivity: false,
    notes: '',
    loggingActive: false,
    logFilePath: null,
    logFolderPath: null,
    logError: null,
    transcript: new PlayTranscript(),
    transcriptHistory: [],
  };
}

export function extractWorldProjection(session: WorldTabSessionState): WorldSessionProjection {
  return {
    currentWorld: session.currentWorld,
    currentCharacter: session.currentCharacter,
    inputBars: session.inputBars,
    outputChunks: session.outputChunks,
    outputEndsWithBr: session.outputEndsWithBr,
    outputRevision: session.outputRevision,
    userScrolled: session.userScrolled,
    activeBar: session.activeBar,
    notesVisible: session.notesVisible,
    highlightsVisible: session.highlightsVisible,
    rulesVisible: session.rulesVisible,
    ruleModalOpen: session.ruleModalOpen,
    ruleModalEditingIndex: session.ruleModalEditingIndex,
    ruleModalDraft: session.ruleModalDraft,
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
