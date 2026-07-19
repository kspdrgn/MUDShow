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
  color: string;
  caseSensitive: boolean;
  wordBoundary: boolean;
}

export interface Rule {
  pattern: string;
  color: string;
  caseSensitive: boolean;
}

export interface RuleDraft extends Rule {
  sampleText: string;
}
