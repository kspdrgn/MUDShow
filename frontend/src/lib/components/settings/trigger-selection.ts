import type { CharacterRecord, TriggerOwner, WorldRecord } from '../../types';
import { APP_TRIGGER_OWNER, triggerOwnerEquals } from '../../triggers';
import type { FlatTreeItem, TreeSelection } from './triggers-tree';
import { getSelectionKey, getOwnerFromFlatItem } from './triggers-tree';

export function getSelectionFromFlatItem(item: FlatTreeItem | null): TreeSelection | null {
  if (!item) {
    return null;
  }

  if (item.kind === 'app') {
    return { kind: 'app' };
  }

  if (item.kind === 'highlight') {
    return { kind: 'highlight', id: item.trigger.id };
  }

  if (item.kind === 'rule') {
    return { kind: 'rule', id: item.trigger.id };
  }

  if (item.kind === 'world') {
    return { kind: 'world', worldId: item.world.id };
  }

  return { kind: 'character', characterId: item.character.id };
}

export function getSelectionRangeKeys(
  items: FlatTreeItem[],
  anchorKey: string,
  targetKey: string,
): string[] | null {
  const anchorIndex = items.findIndex((item) => item.key === anchorKey);
  const targetIndex = items.findIndex((item) => item.key === targetKey);
  if (anchorIndex === -1 || targetIndex === -1) {
    return null;
  }

  const [start, end] = anchorIndex < targetIndex ? [anchorIndex, targetIndex] : [targetIndex, anchorIndex];
  return items.slice(start, end + 1).map((item) => item.key);
}

export function toggleSelectionKeySet(selectedKeys: Set<string>, key: string): Set<string> {
  const nextKeys = new Set(selectedKeys);
  if (nextKeys.has(key)) {
    nextKeys.delete(key);
  } else {
    nextKeys.add(key);
  }

  return nextKeys;
}

export function getClearPasteOwner(selectedKeys: Set<string>, items: FlatTreeItem[]): TriggerOwner | null {
  if (selectedKeys.size === 0) {
    return APP_TRIGGER_OWNER;
  }

  let owner: TriggerOwner | null = null;
  for (const key of selectedKeys) {
    const itemOwner = getOwnerFromFlatItem(items.find((item) => item.key === key) ?? null);
    if (!itemOwner) {
      continue;
    }

    if (!owner) {
      owner = itemOwner;
      continue;
    }

    if (!triggerOwnerEquals(owner, itemOwner)) {
      return null;
    }
  }

  return owner;
}

export function getPreferredNewOwner(options: {
  selectedKeys: Set<string>;
  items: FlatTreeItem[];
  contextWorldId: string | null;
  contextCharacterId: string | null;
  worlds: WorldRecord[];
  characters: CharacterRecord[];
}): TriggerOwner {
  const selectedOwner = getClearPasteOwner(options.selectedKeys, options.items);
  if (selectedOwner) {
    return selectedOwner;
  }

  if (options.contextCharacterId) {
    const contextCharacter = options.characters.find((character) => character.id === options.contextCharacterId) ?? null;
    if (contextCharacter) {
      return { kind: 'character', characterId: contextCharacter.id };
    }
  }

  if (options.contextWorldId && options.worlds.some((world) => world.id === options.contextWorldId)) {
    return { kind: 'world', worldId: options.contextWorldId };
  }

  return APP_TRIGGER_OWNER;
}

export function confirmDiscardDirtyEditor(
  editorDirty: boolean,
  confirmFn: (message: string) => boolean,
): { accepted: boolean; dirty: boolean } {
  if (!editorDirty) {
    return { accepted: true, dirty: false };
  }

  const accepted = confirmFn('Discard unsaved trigger changes?');
  return { accepted, dirty: accepted ? false : true };
}

export function isSelectionKeyPresent(
  selection: Exclude<TreeSelection, { kind: 'new-highlight' } | { kind: 'new-rule' }>,
  selectedKeys: Set<string>,
): boolean {
  return selectedKeys.has(getSelectionKey(selection));
}
