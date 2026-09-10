import { supportsTaps } from '../world-capabilities.js';
import { FUZZBALL_PLUGIN_ID, FUZZBALL_PROPERTY_SERVICE_KEY } from '../fuzzball/plugin.js';
import type { WorldPlugin } from '../world-plugin.js';
import type { WorldSessionAction } from '../world-session-action.js';
import {
  createRideModeQuery,
  createRideModeUpdate,
  parseRideMode,
  RIDE_MODES,
  RIDE_MODE_PROPERTY_PATH,
  type RideMode,
} from './ride-mode.js';

export const TAPS_PLUGIN_ID = 'taps';

export interface RideModeState {
  value: RideMode | null;
  pendingValue: RideMode | null;
  loading: boolean;
  error: string | null;
}

export function createTapsPlugin(): WorldPlugin {
  return {
    id: TAPS_PLUGIN_ID,
    label: 'Taps',
    dependencies: [FUZZBALL_PLUGIN_ID],
    canActivate: ({ world }) => supportsTaps(world),
    createSessionContribution: ({ connection, services }) => {
      const fuzzball = services.get(FUZZBALL_PROPERTY_SERVICE_KEY);
      if (!fuzzball) throw new Error('Taps requires the FuzzBall property service');
      const state: RideModeState = { value: parseRideMode(fuzzball.get(RIDE_MODE_PROPERTY_PATH)?.value), pendingValue: null, loading: true, error: null };
      const listeners = new Set<() => void>();
      const notify = () => { for (const listener of [...listeners]) listener(); };
      const unsubscribe = fuzzball.subscribe(() => {
        state.value = parseRideMode(fuzzball.get(RIDE_MODE_PROPERTY_PATH)?.value);
        state.pendingValue = null;
        state.loading = false;
        notify();
      });
      const selectMode = (raw: string): void => {
        const mode = parseRideMode(raw);
        if (!mode || state.pendingValue) return;
        state.pendingValue = mode;
        state.error = null;
        notify();
        void fuzzball.set(RIDE_MODE_PROPERTY_PATH, mode).catch((error: unknown) => {
          state.pendingValue = null;
          state.error = error instanceof Error ? error.message : 'ride mode update failed';
          notify();
        });
      };
      const getActions = (): readonly WorldSessionAction[] => [{
        kind: 'select',
        id: 'taps-ride-mode',
        label: state.value ?? 'ride mode',
        title: state.error ?? 'select ride mode',
        value: state.pendingValue ?? state.value,
        options: RIDE_MODES.map((value) => ({ value, label: value })),
        disabled: state.loading || state.pendingValue !== null,
        onChange: selectMode,
      }];
      return {
        getActions,
        subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
        onConnected: () => { state.loading = true; state.error = null; connection.send(createRideModeQuery()); notify(); },
        dispose: unsubscribe,
        onDisconnected: () => { state.value = null; state.pendingValue = null; state.loading = false; notify(); },
      };
    },
  };
}

export { createRideModeUpdate };
