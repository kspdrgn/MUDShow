import type { FuzzBallPropertyCacheStore } from './storage-cache.js';
import { parseFuzzballPropertyLine } from './property-line-parser.js';

export function captureFuzzballWorldLine(
  storageCache: FuzzBallPropertyCacheStore,
  worldId: string,
  characterId: string,
  text: string,
): boolean {
  const lines = text.split(/\r\n|\n|\r/u);
  const cache = storageCache.getSessionCache(worldId, characterId);
  let parsedCount = 0;

  for (const line of lines) {
    if (/^\d+\s+(?:property|properties)\s+listed\.$/iu.test(line.trim())) {
      cache.completeNextChildrenLoad();
      continue;
    }

    const parsed = parseFuzzballPropertyLine(line);
    if (!parsed) {
      continue;
    }

    cache.upsertNode(parsed);
    parsedCount += 1;
  }

  return parsedCount > 0;
}
