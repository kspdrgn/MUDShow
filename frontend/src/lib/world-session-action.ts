import type { RideMode } from './taps/ride-mode.js';

export type WorldSessionAction =
  | WorldSessionButtonAction
  | WorldSessionSelectAction;

export interface WorldSessionButtonAction {
  kind: 'button';
  id: string;
  label: string;
  title?: string;
  disabled?: boolean;
  onClick: () => void;
}

export interface WorldSessionSelectOption {
  value: string;
  label: string;
}

export interface WorldSessionSelectAction {
  kind: 'select';
  id: string;
  label: string;
  title?: string;
  value: string | null;
  options: readonly WorldSessionSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
}

export function createRideModeOptions(): readonly WorldSessionSelectOption[] {
  return (['ride', 'hand', 'walk', 'fly'] satisfies readonly RideMode[]).map((value) => ({
    value,
    label: value,
  }));
}
