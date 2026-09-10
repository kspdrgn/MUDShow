import type { WorldRecord } from './types.js';

import type { WorldCompatibility } from './types.js';

export function normalizeWorldCompatibility(value: unknown): WorldCompatibility {
  return value === 'fuzzball' || value === 'taps' ? value : 'telnet';
}

export function supportsFuzzball(world: WorldRecord | null | undefined): boolean {
  return world?.compatibility === 'fuzzball' || world?.compatibility === 'taps';
}

export function supportsTaps(world: WorldRecord | null | undefined): boolean {
  return world?.compatibility === 'taps';
}
