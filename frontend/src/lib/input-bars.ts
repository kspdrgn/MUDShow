export type InputBarId = number;

export interface InputBarConfig {
  id: InputBarId;
  lines: number;
  label: string;
  showStatusDot?: boolean;
}

export const MIN_INPUT_BAR_LINES = 1;
export const MAX_INPUT_BAR_LINES = 10;

export function clampInputBarLines(lines: number): number {
  return Math.min(MAX_INPUT_BAR_LINES, Math.max(MIN_INPUT_BAR_LINES, Math.trunc(lines)));
}

export function createInputBar(id: InputBarId, lines = MIN_INPUT_BAR_LINES): InputBarConfig {
  return {
    id,
    lines: clampInputBarLines(lines),
    label: '',
    showStatusDot: false,
  };
}

export function createInputBars(count: number): InputBarConfig[] {
  return Array.from({ length: Math.max(1, count) }, (_, index) => ({
    id: index + 1,
    lines: MIN_INPUT_BAR_LINES,
    label: index < 2 ? `F${index + 1}` : '',
    showStatusDot: index === 0,
  }));
}

export function normalizeInputBars(bars: InputBarConfig[]): InputBarConfig[] {
  if (bars.length === 0) {
    return createInputBars(1);
  }

  return bars.map((bar, index) => ({
    ...bar,
    lines: clampInputBarLines(bar.lines),
    label: index < 2 ? `F${index + 1}` : '',
    showStatusDot: index === 0,
  }));
}

export function getNextInputBarId(bars: InputBarConfig[]): InputBarId {
  return bars.reduce((max, bar) => Math.max(max, bar.id), 0) + 1;
}

export function getInputBarInputId(barId: InputBarId): string {
  return `input-${barId}`;
}

export function getInputBarContainerId(barId: InputBarId): string {
  return `bar-${barId}`;
}

export function getScopedInputBarInputId(scope: string, barId: InputBarId): string {
  return `${scope}-input-${barId}`;
}

export function getScopedInputBarContainerId(scope: string, barId: InputBarId): string {
  return `${scope}-bar-${barId}`;
}
