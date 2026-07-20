export interface WorldRecord {
  id: string;
  name: string;
  host: string;
  port: number;
  tls: boolean;
  verifyCertificate: boolean;
}

export interface CharacterRecord {
  id: string;
  worldId: string;
  name: string;
  isDefault: boolean;
  width?: number;
  sound?: boolean;
  outputHistoryLines?: number;
  connectString?: string;
}

export interface WorldDraft {
  name: string;
  host: string;
  port: string;
  tls: boolean;
  verifyCertificate: boolean;
}

export interface CharacterDraft {
  name: string;
  width: string;
  sound: boolean;
  outputHistoryLines: string;
  connectString: string;
}

export interface HighlightRule {
  pattern: string;
  foregroundColor: string;
  backgroundColor: string;
  caseSensitive: boolean;
  wordBoundary: boolean;
}

export interface HighlightDraft {
  pattern: string;
  foregroundColor: string;
  backgroundColor: string;
  caseSensitive: boolean;
  wordBoundary: boolean;
}

export interface Rule {
  label: string;
  pattern: string;
  foregroundColor?: string;
  backgroundColor?: string;
  opacity?: number;
  wholeLine: boolean;
  caseSensitive: boolean;
  sampleText: string;
}

export interface RuleDraft {
  label: string;
  pattern: string;
  foregroundColor: string;
  foregroundColorEnabled: boolean;
  backgroundColor: string;
  backgroundColorEnabled: boolean;
  opacity: number;
  opacityEnabled: boolean;
  wholeLine: boolean;
  caseSensitive: boolean;
  sampleText: string;
}
