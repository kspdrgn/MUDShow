export interface TextSelectionInfo {
  selectionStart: number;
  selectionEnd: number;
  selectedText: string;
}

export function getTextSelectionInfo(input: HTMLTextAreaElement | null): TextSelectionInfo | null {
  if (!input) {
    return null;
  }

  const selectionStart = input.selectionStart ?? 0;
  const selectionEnd = input.selectionEnd ?? selectionStart;
  return {
    selectionStart,
    selectionEnd,
    selectedText: input.value.slice(selectionStart, selectionEnd),
  };
}

export function replaceSelectedText(
  input: HTMLTextAreaElement | null,
  replacement: string,
  start?: number,
  end?: number,
): void {
  if (!input) {
    return;
  }

  const selectionStart = start ?? input.selectionStart ?? 0;
  const selectionEnd = end ?? input.selectionEnd ?? selectionStart;
  input.setRangeText(replacement, selectionStart, selectionEnd, 'end');
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.focus();
}

export function getSelectedSpellcheckWord(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  getWordBounds: (value: string, selectionStart: number, selectionEnd: number) => { word?: string } | null,
): { selectedText: string; word: string } {
  const selectedText = value.slice(selectionStart, selectionEnd).trim();
  const word = getWordBounds(value, selectionStart, selectionEnd);
  return {
    selectedText,
    word: selectedText || word?.word || '',
  };
}
