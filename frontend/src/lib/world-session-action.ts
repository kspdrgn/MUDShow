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
