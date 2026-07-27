import type { Rule, RuleDraft } from '../../types';

export const DEFAULT_SAMPLE_TEXT = 'sample text to test the rule\ntry adding anchors like ^ and $';

export const DEFAULT_RULE_DRAFT: RuleDraft = {
  label: '',
  pattern: '',
  foregroundColor: '#ffffff',
  foregroundColorEnabled: true,
  backgroundColor: '#000000',
  backgroundColorEnabled: true,
  opacity: 1,
  opacityEnabled: true,
  wholeLine: false,
  caseSensitive: false,
  stopOtherRules: false,
  stopHighlights: false,
  sampleText: DEFAULT_SAMPLE_TEXT,
};

type MatchIndices = Array<[number, number] | undefined>;
type MatchWithIndices = RegExpMatchArray & {
  indices?: MatchIndices;
};

export interface RuleSamplePreview {
  html: string;
  validationError: string;
  saveDisabled: boolean;
}

export function createDefaultRuleDraft(): RuleDraft {
  return { ...DEFAULT_RULE_DRAFT };
}

export function createRuleDraft(rule: Rule | null | undefined): RuleDraft {
  if (!rule) {
    return createDefaultRuleDraft();
  }

  return {
    label: rule.label,
    pattern: rule.pattern,
    foregroundColor: rule.foregroundColor ?? '#ffffff',
    foregroundColorEnabled: rule.foregroundColor !== undefined,
    backgroundColor: rule.backgroundColor ?? '#000000',
    backgroundColorEnabled: rule.backgroundColor !== undefined,
    opacity: rule.opacity ?? 1,
    opacityEnabled: rule.opacity !== undefined,
    wholeLine: rule.wholeLine,
    caseSensitive: rule.caseSensitive,
    stopOtherRules: rule.stopOtherRules,
    stopHighlights: rule.stopHighlights,
    sampleText: rule.sampleText || DEFAULT_SAMPLE_TEXT,
  };
}

export function serializeRuleDraft(draft: RuleDraft): string {
  return JSON.stringify({
    label: draft.label,
    pattern: draft.pattern,
    foregroundColor: draft.foregroundColor,
    foregroundColorEnabled: draft.foregroundColorEnabled,
    backgroundColor: draft.backgroundColor,
    backgroundColorEnabled: draft.backgroundColorEnabled,
    opacity: draft.opacity,
    opacityEnabled: draft.opacityEnabled,
    wholeLine: draft.wholeLine,
    caseSensitive: draft.caseSensitive,
    stopOtherRules: draft.stopOtherRules,
    stopHighlights: draft.stopHighlights,
    sampleText: draft.sampleText,
  });
}

export function normalizeRuleDraftForSave(draft: RuleDraft): RuleDraft {
  return {
    ...draft,
    label: draft.label.trim(),
    pattern: draft.pattern.trim(),
  };
}

export function buildRuleSamplePreview(
  pattern: string,
  sampleText: string,
  wholeLine: boolean,
  caseSensitive: boolean,
): RuleSamplePreview {
  const trimmed = pattern.trim();
  if (!trimmed) {
    return {
      html: escapeHtml(sampleText).replace(/\n/g, '<br>'),
      validationError: 'enter a regexp pattern',
      saveDisabled: true,
    };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(trimmed, caseSensitive ? 'gdm' : 'gdim');
  } catch (error) {
    return {
      html: escapeHtml(sampleText).replace(/\n/g, '<br>'),
      validationError: error instanceof Error ? error.message : 'invalid regexp',
      saveDisabled: true,
    };
  }

  return {
    html: buildSampleMirrorHtml(regex, sampleText, wholeLine),
    validationError: '',
    saveDisabled: false,
  };
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function getLineRange(sampleText: string, index: number): { start: number; end: number } {
  const lineStart = sampleText.lastIndexOf('\n', Math.max(0, index - 1)) + 1;
  const nextLineBreak = sampleText.indexOf('\n', index);
  return {
    start: lineStart,
    end: nextLineBreak >= 0 ? nextLineBreak : sampleText.length,
  };
}

function collectSampleRanges(
  sampleText: string,
  regex: RegExp,
  wholeLine: boolean,
): Array<{ start: number; end: number; zeroWidth?: boolean }> {
  const ranges: Array<{ start: number; end: number; zeroWidth?: boolean }> = [];

  for (const match of sampleText.matchAll(regex) as Iterable<MatchWithIndices>) {
    const index = match.index ?? 0;
    const matched = match[0];
    const matchEnd = index + matched.length;

    if (wholeLine) {
      ranges.push(getLineRange(sampleText, index));
      continue;
    }

    if (match.length > 1) {
      for (let groupIndex = 1; groupIndex < match.length; groupIndex += 1) {
        const group = match[groupIndex];
        if (!group) {
          continue;
        }

        const indexedGroup = match.indices?.[groupIndex];
        if (indexedGroup && indexedGroup[1] > indexedGroup[0]) {
          ranges.push({ start: indexedGroup[0], end: indexedGroup[1] });
          continue;
        }

        const searchFrom = ranges.length > 0 ? ranges[ranges.length - 1].end : index;
        const fallbackStart = sampleText.indexOf(group, searchFrom);
        if (fallbackStart >= index && fallbackStart < matchEnd) {
          ranges.push({ start: fallbackStart, end: fallbackStart + group.length });
        }
      }
      continue;
    }

    if (matched.length === 0) {
      ranges.push({ start: index, end: index, zeroWidth: true });
      continue;
    }

    ranges.push({ start: index, end: matchEnd });
  }

  return ranges
    .sort((left, right) => left.start - right.start || left.end - right.end)
    .reduce<Array<{ start: number; end: number; zeroWidth?: boolean }>>((merged, range) => {
      const previous = merged[merged.length - 1];
      if (previous && !previous.zeroWidth && !range.zeroWidth && range.start <= previous.end) {
        previous.end = Math.max(previous.end, range.end);
        return merged;
      }

      merged.push({ ...range });
      return merged;
    }, []);
}

function buildSampleMirrorHtml(regex: RegExp, sampleText: string, wholeLine: boolean): string {
  let result = '';
  let lastIndex = 0;

  for (const range of collectSampleRanges(sampleText, regex, wholeLine)) {
    if (range.start < lastIndex) {
      continue;
    }

    result += escapeHtml(sampleText.slice(lastIndex, range.start));
    if (range.zeroWidth) {
      result += '<span class="rule-preview-zero-width">∅</span>';
      lastIndex = range.start;
      continue;
    }

    result += `<span class="rule-preview-hit">${escapeHtml(sampleText.slice(range.start, range.end))}</span>`;
    lastIndex = range.end;
  }

  result += escapeHtml(sampleText.slice(lastIndex));
  return result.replace(/\n/g, '<br>');
}
