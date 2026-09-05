export type RideMode = 'ride' | 'hand' | 'walk' | 'fly';

export const RIDE_MODE_PROPERTY_PATH = '/ride/_mode';
export const RIDE_MODES: readonly RideMode[] = ['ride', 'hand', 'walk', 'fly'];

export function parseRideMode(value: string | null | undefined): RideMode | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  return RIDE_MODES.includes(normalized as RideMode)
    ? normalized as RideMode
    : null;
}

export function createRideModeQuery(): string {
  return `examine me=${RIDE_MODE_PROPERTY_PATH}\r\n`;
}

export function createRideModeUpdate(mode: RideMode): string {
  return `@set me=${RIDE_MODE_PROPERTY_PATH}:${mode}\r\n`;
}
