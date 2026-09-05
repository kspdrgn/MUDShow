import type { FuzzBallPropertyNodeSnapshot } from './storage-cache.js';
import { fuzzballStorageCache } from './storage-cache.js';
import { createWorldSessionKey, type WorldSessionContainerRegistry } from '../world-session-container.js';

export interface FuzzBallPropertyService {
  get(path: string): FuzzBallPropertyNodeSnapshot | null;
  refresh(path: string): void;
  set(path: string, value: string): Promise<void>;
  subscribe(listener: () => void): () => void;
}

export function createFuzzBallPropertyService(
  worldId: string,
  characterId: string,
  worldSessionContainers: WorldSessionContainerRegistry,
): FuzzBallPropertyService {
  const cache = fuzzballStorageCache.getSessionCache(worldId, characterId);
  const key = createWorldSessionKey(worldId, characterId);

  return {
    get(path: string): FuzzBallPropertyNodeSnapshot | null {
      return cache.getSnapshot(path);
    },
    refresh(path: string): void {
      const requestPath = path === '/' || path.endsWith('/') ? path : path;
      const command = `examine me=${requestPath}\r\n`;
      worldSessionContainers.connection.get(key)?.send(command);
    },
    async set(path: string, value: string): Promise<void> {
      worldSessionContainers.connection.get(key)?.send(`@set me=${path}:${value}\r\n`);
    },
    subscribe(listener: () => void): () => void {
      return cache.subscribe(listener);
    },
  };
}
