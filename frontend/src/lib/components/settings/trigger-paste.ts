import type { HighlightDraft, HighlightRule, Rule, RuleDraft, Trigger } from '../../types';

export type ValidPastedTrigger =
  | { kind: 'highlight'; draft: HighlightDraft }
  | { kind: 'rule'; draft: RuleDraft };

export function buildCopyPayload(triggers: Trigger[]): Array<Record<string, unknown>> {
  const payload: Array<Record<string, unknown>> = [];

  for (const item of triggers) {
    if (item.type === 'highlight') {
      payload.push({
        type: 'highlight',
        pattern: item.pattern,
        foregroundColor: item.foregroundColor,
        backgroundColor: item.backgroundColor,
        caseSensitive: item.caseSensitive,
        wordBoundary: item.wordBoundary,
      });
      continue;
    }

    payload.push({
      type: 'rule',
      label: item.label,
      pattern: item.pattern,
      foregroundColor: item.foregroundColor,
      backgroundColor: item.backgroundColor,
      opacity: item.opacity,
      wholeLine: item.wholeLine,
      caseSensitive: item.caseSensitive,
      stopOtherRules: item.stopOtherRules,
      stopHighlights: item.stopHighlights,
      sampleText: item.sampleText,
    });
  }

  return payload;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === 'string';
}

export function getOptionalColor(value: unknown): { value: string; enabled: boolean } | null {
  if (value === undefined) {
    return { value: '#000000', enabled: false };
  }

  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  return { value: trimmed, enabled: true };
}

export function normalizePastedHighlight(value: Record<string, unknown>): HighlightDraft | null {
  if (value.type !== 'highlight' || typeof value.pattern !== 'string') {
    return null;
  }

  if (typeof value.caseSensitive !== 'boolean' || typeof value.wordBoundary !== 'boolean') {
    return null;
  }

  const pattern = value.pattern.trim();
  if (!pattern) {
    return null;
  }

  const foregroundColor = getOptionalColor(value.foregroundColor);
  const backgroundColor = getOptionalColor(value.backgroundColor);
  if (!foregroundColor || !backgroundColor) {
    return null;
  }

  return {
    pattern,
    foregroundColor: foregroundColor.enabled ? foregroundColor.value : '#ffffff',
    foregroundColorEnabled: foregroundColor.enabled,
    backgroundColor: backgroundColor.enabled ? backgroundColor.value : '#000000',
    backgroundColorEnabled: backgroundColor.enabled,
    caseSensitive: value.caseSensitive,
    wordBoundary: value.wordBoundary,
  };
}

export function normalizePastedRule(value: Record<string, unknown>): RuleDraft | null {
  if (value.type !== 'rule' || typeof value.pattern !== 'string') {
    return null;
  }

  if (
    !isOptionalString(value.label) ||
    typeof value.wholeLine !== 'boolean' ||
    typeof value.caseSensitive !== 'boolean' ||
    (value.stopOtherRules !== undefined && typeof value.stopOtherRules !== 'boolean') ||
    (value.stopHighlights !== undefined && typeof value.stopHighlights !== 'boolean') ||
    !isOptionalString(value.sampleText)
  ) {
    return null;
  }

  const pattern = value.pattern.trim();
  if (!pattern) {
    return null;
  }

  try {
    new RegExp(pattern, value.caseSensitive ? 'gdm' : 'gdim');
  } catch {
    return null;
  }

  const foregroundColor = getOptionalColor(value.foregroundColor);
  const backgroundColor = getOptionalColor(value.backgroundColor);
  if (!foregroundColor || !backgroundColor) {
    return null;
  }

  let opacity = 1;
  let opacityEnabled = false;
  if (value.opacity !== undefined) {
    if (typeof value.opacity !== 'number' || !Number.isFinite(value.opacity) || value.opacity < 0 || value.opacity > 1) {
      return null;
    }

    opacity = value.opacity;
    opacityEnabled = true;
  }

  return {
    label: value.label?.trim() ?? '',
    pattern,
    foregroundColor: foregroundColor.enabled ? foregroundColor.value : '#ffffff',
    foregroundColorEnabled: foregroundColor.enabled,
    backgroundColor: backgroundColor.enabled ? backgroundColor.value : '#000000',
    backgroundColorEnabled: backgroundColor.enabled,
    opacity,
    opacityEnabled,
    wholeLine: value.wholeLine,
    caseSensitive: value.caseSensitive,
    stopOtherRules: value.stopOtherRules === true,
    stopHighlights: value.stopHighlights === true,
    sampleText: value.sampleText?.trim() || 'sample text to test the rule',
  };
}

export function normalizePastedTrigger(value: unknown): ValidPastedTrigger | null {
  if (!isRecord(value)) {
    return null;
  }

  if (value.type === 'highlight') {
    const draft = normalizePastedHighlight(value);
    return draft ? { kind: 'highlight', draft } : null;
  }

  if (value.type === 'rule') {
    const draft = normalizePastedRule(value);
    return draft ? { kind: 'rule', draft } : null;
  }

  return null;
}

export function normalizePastedTriggerPayload(raw: unknown): { triggers: ValidPastedTrigger[]; skipped: number } | null {
  const entries = Array.isArray(raw) ? raw : isRecord(raw) ? [raw] : null;
  if (!entries) {
    return null;
  }

  const triggers: ValidPastedTrigger[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const normalized = normalizePastedTrigger(entry);
    if (normalized) {
      triggers.push(normalized);
    } else {
      skipped += 1;
    }
  }

  return { triggers, skipped };
}
