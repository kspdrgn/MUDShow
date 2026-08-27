import { fuzzballStorageCache } from './storage-cache.js';
import { parseFuzzballPropertyLine } from './property-line-parser.js';

export function captureFuzzballWorldLine(
  worldId: string,
  characterId: string,
  text: string,
): boolean {
  const lines = text.split(/\r\n|\n|\r/u);
  const cache = fuzzballStorageCache.getSessionCache(worldId, characterId);
  let parsedCount = 0;

  for (const line of lines) {
    const parsed = parseFuzzballPropertyLine(line);
    if (!parsed) {
      continue;
    }

    cache.upsertNode(parsed);
    parsedCount += 1;
  }

  return parsedCount > 0;
}
