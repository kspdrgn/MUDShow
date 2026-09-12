import type { WorldConnectionPort } from '../world-plugin.js';
import { parseFuzzballPropertyLine } from './property-line-parser.js';

export interface FuzzBallPropertySnapshot {
  path: string;
  value: string;
  updatedAt: number;
}

export interface FuzzBallPropertyService {
  get(path: string): FuzzBallPropertySnapshot | null;
  refresh(path: string): void;
  set(path: string, value: string): Promise<void>;
  captureLine(line: string): boolean;
  subscribe(listener: () => void): () => void;
  clear(): void;
}

export function createFuzzBallPropertyService(connection: WorldConnectionPort): FuzzBallPropertyService {
  const values = new Map<string, FuzzBallPropertySnapshot>();
  const listeners = new Set<() => void>();
  const notify = () => { for (const listener of [...listeners]) listener(); };
  const normalizePath = (path: string) => {
    const trimmed = path.trim();
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  };

  return {
    get(path) { return values.get(normalizePath(path)) ?? null; },
    refresh(path) { connection.send(`examine me=${normalizePath(path)}\r\n`); },
    async set(path, value) {
      connection.send(`@set me=${normalizePath(path)}:${value}\r\n`);
    },
    captureLine(line) {
      let captured = false;
      for (const part of line.split(/\r\n|\n|\r/u)) {
        const parsed = parseFuzzballPropertyLine(part);
        let rawPath: string | undefined;
        let rawValue: string | undefined;
        if (parsed?.value !== null && parsed) {
          rawPath = parsed.path;
          rawValue = parsed.value;
        } else {
          const match = part.trim().match(/^(?:property\s+)?(\/[^\s:=]+)\s*(?:=|:)\s*(.*?)\s*$/i);
          rawPath = match?.[1];
          rawValue = match?.[2];
        }
        if (!rawPath || rawValue === undefined) continue;

        const path = normalizePath(rawPath);
        const value = rawValue;
        values.set(path, { path, value, updatedAt: Date.now() });
        captured = true;
      }

      if (captured) notify();
      return captured;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    clear() { values.clear(); notify(); },
  };
}
