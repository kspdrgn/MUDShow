export type WorldSessionAction =
  | {
      kind: 'button';
      id: string;
      label: string;
      title?: string;
      disabled?: boolean;
      onClick: () => void;
    }
  | {
      kind: 'select';
      id: string;
      label: string;
      title?: string;
      value: string | null;
      options: readonly { value: string; label: string }[];
      disabled?: boolean;
      onChange: (value: string) => void;
    };
