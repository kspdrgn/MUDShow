import type { FuzzBallPropertyTreeCache } from './storage-cache.js';
import { parseFuzzballPropertyLine } from './property-line-parser.js';

export function captureFuzzballWorldLine(
  text: string,
  cache: FuzzBallPropertyTreeCache,
): boolean {
  const lines = text.split(/\r\n|\n|\r/u);
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
