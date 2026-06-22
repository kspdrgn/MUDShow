export interface Character {
  name: string;
  host: string;
  port: number;
  tls?: boolean;
  verifyCertificate?: boolean;
  width?: number;
  sound?: boolean;
}

export interface CharacterDraft {
  name: string;
  host: string;
  port: string;
  tls: boolean;
  verifyCertificate: boolean;
  width: string;
  sound: boolean;
}

export interface HighlightRule {
  pattern: string;
  color: string;
}
