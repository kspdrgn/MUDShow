import type { Writable } from 'svelte/store';
import { buildHighlightRegexes } from './formatting';
import { saveTriggers } from './storage';
import { APP_TRIGGER_OWNER, createTriggerId, triggerOwnerEquals } from './triggers';
import type { HighlightDraft, HighlightRule, Rule, RuleDraft, Trigger, TriggerOwner, CharacterRecord } from './types';
import type { SessionState } from './session-state';

interface TriggerActionContext {
  getState: () => SessionState;
  patch: (patch: Partial<SessionState>) => void;
  setHighlightRegexes: (regexes: ReturnType<typeof buildHighlightRegexes>) => void;
}

function getHighlightTriggers(triggers: Trigger[]): HighlightRule[] {
  return triggers.filter((trigger): trigger is HighlightRule => trigger.type === 'highlight');
}

export function removeTriggersForWorld(
  triggers: Trigger[],
  worldId: string,
  removedCharacters: CharacterRecord[],
): Trigger[] {
  const removedCharacterIds = new Set(removedCharacters.map((character) => character.id));
  return triggers.filter((trigger) => {
    if (trigger.owner.kind === 'world') {
      return trigger.owner.worldId !== worldId;
    }

    if (trigger.owner.kind === 'character') {
      return !removedCharacterIds.has(trigger.owner.characterId);
    }

    return true;
  });
}

export function removeTriggersForCharacter(triggers: Trigger[], characterId: string): Trigger[] {
  return triggers.filter((trigger) => trigger.owner.kind !== 'character' || trigger.owner.characterId !== characterId);
}

function findTriggerIndexByTypeIndex(triggers: Trigger[], type: Trigger['type'], typeIndex: number): number {
  let seen = -1;

  return triggers.findIndex((trigger) => {
    if (trigger.type !== type) {
      return false;
    }

    seen += 1;
    return seen === typeIndex;
  });
}

function findTriggerIndexById(triggers: Trigger[], id: string | null): number {
  return id ? triggers.findIndex((trigger) => trigger.id === id) : -1;
}

export function createTriggerActions({
  getState,
  patch,
  setHighlightRegexes,
}: TriggerActionContext) {
  function syncHighlightRegexes(nextTriggers: Trigger[]): void {
    setHighlightRegexes(buildHighlightRegexes(getHighlightTriggers(nextTriggers)));
  }

  function updateHighlight(index: number, updater: (rule: HighlightRule) => HighlightRule): void {
    const state = getState();
    const triggerIndex = findTriggerIndexByTypeIndex(state.triggers, 'highlight', index);
    const current = triggerIndex >= 0 ? state.triggers[triggerIndex] : null;
    if (!current || current.type !== 'highlight') {
      return;
    }

    const next = [...state.triggers];
    next[triggerIndex] = updater(current);
    void saveTriggers(next);
    syncHighlightRegexes(next);
    patch({ triggers: next });
  }

  function saveHighlightDraft(id: string | null, owner: TriggerOwner, draft: HighlightDraft): void {
    const nextHighlight: HighlightRule = {
      id: '',
      type: 'highlight',
      owner: APP_TRIGGER_OWNER,
      pattern: draft.pattern.trim(),
      caseSensitive: draft.caseSensitive,
      wordBoundary: draft.wordBoundary,
    };

    if (!nextHighlight.pattern) {
      return;
    }

    if (draft.foregroundColorEnabled) {
      nextHighlight.foregroundColor = draft.foregroundColor.trim() || '#ffffff';
    }

    if (draft.backgroundColorEnabled) {
      nextHighlight.backgroundColor = draft.backgroundColor.trim() || '#000000';
    }

    const state = getState();
    const next = [...state.triggers];
    const triggerIndex = findTriggerIndexById(next, id);
    const existing = triggerIndex >= 0 ? next[triggerIndex] : null;
    nextHighlight.id = existing?.id ?? createTriggerId();
    nextHighlight.owner = existing?.owner ?? owner;

    if (triggerIndex < 0) {
      next.push(nextHighlight);
    } else {
      next[triggerIndex] = nextHighlight;
    }

    void saveTriggers(next);
    syncHighlightRegexes(next);
    patch({ triggers: next });
  }

  function deleteHighlight(id: string): void {
    const state = getState();
    const triggerIndex = findTriggerIndexById(state.triggers, id);
    if (triggerIndex < 0) {
      return;
    }

    const next = [...state.triggers];
    next.splice(triggerIndex, 1);
    void saveTriggers(next);
    syncHighlightRegexes(next);
    patch({ triggers: next });
  }

  function saveRuleDraft(id: string | null, owner: TriggerOwner, draft: RuleDraft): void {
    const state = getState();
    const next = [...state.triggers];
    const nextRule: Rule = {
      id: '',
      type: 'rule',
      owner: APP_TRIGGER_OWNER,
      label: draft.label.trim(),
      pattern: draft.pattern.trim(),
      caseSensitive: draft.caseSensitive,
      sampleText: draft.sampleText,
      wholeLine: draft.wholeLine,
      stopOtherRules: draft.stopOtherRules,
      stopHighlights: draft.stopHighlights,
    };

    if (draft.foregroundColorEnabled) {
      nextRule.foregroundColor = draft.foregroundColor.trim() || '#ffffff';
    }

    if (draft.backgroundColorEnabled) {
      nextRule.backgroundColor = draft.backgroundColor.trim() || '#000000';
    }

    if (draft.opacityEnabled) {
      nextRule.opacity = Math.min(1, Math.max(0, draft.opacity));
    }

    if (!nextRule.pattern) {
      return;
    }

    const triggerIndex = findTriggerIndexById(next, id);
    const existing = triggerIndex >= 0 ? next[triggerIndex] : null;
    nextRule.id = existing?.id ?? createTriggerId();
    nextRule.owner = existing?.owner ?? owner;

    if (triggerIndex < 0) {
      next.push(nextRule);
    } else {
      next[triggerIndex] = nextRule;
    }

    void saveTriggers(next);
    patch({ triggers: next });
  }

  function deleteRule(id: string): void {
    const state = getState();
    const triggerIndex = findTriggerIndexById(state.triggers, id);
    if (triggerIndex < 0) {
      return;
    }

    const next = [...state.triggers];
    next.splice(triggerIndex, 1);
    void saveTriggers(next);
    patch({ triggers: next });
  }

  function moveTrigger(id: string, owner: TriggerOwner, beforeTriggerId: string | null = null): void {
    const state = getState();
    const trigger = state.triggers.find((entry) => entry.id === id);
    if (!trigger) {
      return;
    }

    const remaining = state.triggers.filter((entry) => entry.id !== id);
    const moved = { ...trigger, owner };
    const next = [...remaining];
    const beforeIndex = beforeTriggerId
      ? next.findIndex(
          (entry) =>
            entry.id === beforeTriggerId &&
            entry.type === moved.type &&
            triggerOwnerEquals(entry.owner, owner),
        )
      : -1;

    if (beforeIndex >= 0) {
      next.splice(beforeIndex, 0, moved);
    } else {
      const insertAfterIndex = remaining.reduce((lastIndex, entry, index) => {
        return entry.type === moved.type && triggerOwnerEquals(entry.owner, owner) ? index : lastIndex;
      }, -1);
      next.splice(insertAfterIndex + 1, 0, moved);
    }

    void saveTriggers(next);
    syncHighlightRegexes(next);
    patch({ triggers: next });
  }

  return {
    updateHighlight,
    saveHighlightDraft,
    deleteHighlight,
    saveRuleDraft,
    deleteRule,
    moveTrigger,
  };
}
