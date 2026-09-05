import type { WorldRecord } from './types.js';

export function supportsFuzzball(world: WorldRecord | null | undefined): boolean {
  const compatibility = world?.compatibility as string | undefined;
  return compatibility === 'fuzzball' || compatibility === 'taps';
}

export function supportsTaps(world: WorldRecord | null | undefined): boolean {
  return (world?.compatibility as string | undefined) === 'taps';
}
