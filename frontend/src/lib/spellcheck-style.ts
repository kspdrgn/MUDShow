export const DEFAULT_SQUIGGLE_COLOR = '#ff0000';
export const SQUIGGLE_PREVIEW_WAVY_PATH =
  'M 4 13 C 7 6, 11 6, 14 13 S 21 20, 24 13 S 31 6, 34 13 S 41 20, 44 13 S 51 6, 54 13 S 61 20, 64 13 S 71 6, 74 13 S 81 20, 84 13 S 91 6, 94 13 S 101 20, 104 13 S 111 6, 114 13';

export const SQUIGGLE_STYLE_OPTIONS = [
  { value: 'wavy', label: 'wavy' },
  { value: 'dashed', label: 'dashes' },
  { value: 'dotted', label: 'dots' },
  { value: 'solid', label: 'solid' },
] as const;

export type SquiggleStyleValue = (typeof SQUIGGLE_STYLE_OPTIONS)[number]['value'];

export function isHexColor(input: string): boolean {
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(input.trim());
}

export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);

  if (!match) {
    return null;
  }

  const hex = match[1].toLowerCase();
  if (hex.length === 3) {
    return `#${hex
      .split('')
      .map((character) => character + character)
      .join('')}`;
  }

  return `#${hex}`;
}

export function getSquiggleColorPickerValue(value: string): string {
  const currentValue = value.trim();
  if (isHexColor(currentValue)) {
    return currentValue.toLowerCase();
  }

  return DEFAULT_SQUIGGLE_COLOR;
}

export function normalizeSquiggleStyle(value: string): SquiggleStyleValue {
  const trimmed = value.trim().toLowerCase();
  if (trimmed === 'zigzag') {
    return 'wavy';
  }

  return SQUIGGLE_STYLE_OPTIONS.some((option) => option.value === trimmed)
    ? (trimmed as SquiggleStyleValue)
    : 'wavy';
}

export function getSquigglePreviewDecorationStyle(value: string): SquiggleStyleValue {
  switch (value) {
    case 'dashed':
    case 'dotted':
    case 'solid':
    case 'wavy':
      return value;
    default:
      return 'wavy';
  }
}

export function getSquigglePreviewDasharray(value: string): string | null {
  switch (value) {
    case 'dashed':
      return '12 7';
    case 'dotted':
      return '1 6';
    case 'solid':
      return null;
    default:
      return null;
  }
}

export function getSquiggleDecorationStyle(value: string): SquiggleStyleValue {
  return getSquigglePreviewDecorationStyle(value);
}
