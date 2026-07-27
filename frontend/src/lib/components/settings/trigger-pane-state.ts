import type { CharacterRecord, HighlightRule, Rule, Trigger, TriggerOwner, WorldRecord } from '../../types';
import { triggerOwnerEquals } from '../../triggers';
import type { SelectableTreeSelection, TreeSelection } from './triggers-tree';

export function resolvePendingNewSelection(
  triggers: Trigger[],
  pendingNewSelection: { type: Trigger['type']; owner: TriggerOwner } | null,
): SelectableTreeSelection | null {
  if (!pendingNewSelection) {
    return null;
  }

  const candidates = triggers.filter(
    (trigger) => trigger.type === pendingNewSelection.type && triggerOwnerEquals(trigger.owner, pendingNewSelection.owner),
  );
  const created = candidates[candidates.length - 1] ?? null;
  if (created?.type === 'highlight') {
    return { kind: 'highlight', id: created.id };
  }

  if (created?.type === 'rule') {
    return { kind: 'rule', id: created.id };
  }

  return null;
}

export function isTriggerSelectionValid(
  selection: TreeSelection | null,
  triggers: Trigger[],
  worlds: WorldRecord[],
  visibleCharacters: CharacterRecord[],
): boolean {
  if (!selection) {
    return true;
  }

  if (selection.kind === 'highlight' || selection.kind === 'rule') {
    return triggers.some((trigger) => trigger.id === selection.id);
  }

  if (selection.kind === 'world') {
    return worlds.some((world) => world.id === selection.worldId);
  }

  if (selection.kind === 'character') {
    return visibleCharacters.some((character) => character.id === selection.characterId);
  }

  return true;
}

export function getClampedContextMenuPosition(
  x: number,
  y: number,
  menuElement: HTMLElement,
  windowSize: { width: number; height: number },
  margin = 8,
): { x: number; y: number } {
  const rect = menuElement.getBoundingClientRect();
  return {
    x: Math.min(x, windowSize.width - rect.width - margin),
    y: Math.min(y, windowSize.height - rect.height - margin),
  };
}
