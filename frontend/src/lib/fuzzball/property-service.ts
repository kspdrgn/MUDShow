import type { WorldConnectionPort } from '../world-plugin.js';

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
      const match = line.trim().match(/^(?:property\s+)?(\/[^\s:=]+)\s*(?:=|:)\s*(.*?)\s*$/i);
      if (!match) return false;
      values.set(normalizePath(match[1]), { path: normalizePath(match[1]), value: match[2], updatedAt: Date.now() });
      notify();
      return true;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    clear() { values.clear(); notify(); },
  };
}
