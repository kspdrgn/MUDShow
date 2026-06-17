export interface Character {
  name: string;
  host: string;
  port: number;
  tls?: boolean;
  width?: number;
  sound?: boolean;
}

export interface HighlightRule {
  pattern: string;
  color: string;
}
