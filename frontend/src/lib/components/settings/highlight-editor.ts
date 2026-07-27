import type { HighlightDraft, HighlightRule } from '../../types';

export const DEFAULT_HIGHLIGHT_DRAFT: HighlightDraft = {
  pattern: '',
  foregroundColor: '#ffffff',
  foregroundColorEnabled: true,
  backgroundColor: '#000000',
  backgroundColorEnabled: true,
  caseSensitive: false,
  wordBoundary: true,
};

export function createDefaultHighlightDraft(): HighlightDraft {
  return { ...DEFAULT_HIGHLIGHT_DRAFT };
}

export function createHighlightDraft(highlight: HighlightRule | null | undefined): HighlightDraft {
  if (!highlight) {
    return createDefaultHighlightDraft();
  }

  return {
    pattern: highlight.pattern,
    foregroundColor: highlight.foregroundColor ?? '#ffffff',
    foregroundColorEnabled: highlight.foregroundColor !== undefined,
    backgroundColor: highlight.backgroundColor ?? '#000000',
    backgroundColorEnabled: highlight.backgroundColor !== undefined,
    caseSensitive: highlight.caseSensitive,
    wordBoundary: highlight.wordBoundary,
  };
}

export function serializeHighlightDraft(draft: HighlightDraft): string {
  return JSON.stringify({
    pattern: draft.pattern,
    foregroundColor: draft.foregroundColor,
    foregroundColorEnabled: draft.foregroundColorEnabled,
    backgroundColor: draft.backgroundColor,
    backgroundColorEnabled: draft.backgroundColorEnabled,
    caseSensitive: draft.caseSensitive,
    wordBoundary: draft.wordBoundary,
  });
}

export function normalizeHighlightDraftForSave(draft: HighlightDraft): HighlightDraft {
  return {
    ...draft,
    pattern: draft.pattern.trim(),
  };
}
