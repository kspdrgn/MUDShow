import { fuzzballStorageCache } from './storage-cache';
import { parseFuzzballPropertyLine } from './property-line-parser';

export function captureFuzzballWorldLine(
  worldId: string,
  characterId: string,
  text: string,
): boolean {
  const parsed = parseFuzzballPropertyLine(text);
  if (!parsed) {
    return false;
  }

  fuzzballStorageCache.getSessionCache(worldId, characterId).upsertNode(parsed);
  return true;
}
