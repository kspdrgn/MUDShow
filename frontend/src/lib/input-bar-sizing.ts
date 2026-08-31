import {
  clampInputBarLines,
  MAX_AUTO_INPUT_BAR_LINES,
} from './input-bars.js';

export interface InputBarHeightInput {
  lines: number;
  contentHeight: number;
  lineHeight: number;
  verticalPadding?: number;
  verticalBorder?: number;
  automaticMaximumLines?: number;
}

export interface InputBarHeightResult {
  manualMinimumHeight: number;
  automaticMaximumHeight: number;
  effectiveHeight: number;
  shouldScroll: boolean;
}

export function calculateInputBarHeight({
  lines,
  contentHeight,
  lineHeight,
  verticalPadding = 0,
  verticalBorder = 0,
  automaticMaximumLines = MAX_AUTO_INPUT_BAR_LINES,
}: InputBarHeightInput): InputBarHeightResult {
  const decorationHeight = verticalPadding + verticalBorder;
  const manualMinimumHeight = lineHeight * clampInputBarLines(lines) + decorationHeight;
  const automaticMaximumHeight = lineHeight * automaticMaximumLines + decorationHeight;
  const effectiveHeight = Math.max(
    manualMinimumHeight,
    Math.min(contentHeight, automaticMaximumHeight),
  );

  return {
    manualMinimumHeight,
    automaticMaximumHeight,
    effectiveHeight,
    shouldScroll: contentHeight > effectiveHeight + 1,
  };
}
