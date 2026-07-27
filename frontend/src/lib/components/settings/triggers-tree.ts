import type { CharacterRecord, HighlightRule, Rule, Trigger, TriggerOwner, WorldRecord } from '../../types';
import { APP_TRIGGER_OWNER, getOwnerTriggers, triggerOwnerEquals } from '../../triggers';

export type TreeSelection =
  | { kind: 'app' }
  | { kind: 'highlight'; id: string }
  | { kind: 'new-highlight' }
  | { kind: 'rule'; id: string }
  | { kind: 'new-rule' }
  | { kind: 'world'; worldId: string }
  | { kind: 'character'; characterId: string };

export type SelectableTreeSelection = Exclude<TreeSelection, { kind: 'new-highlight' } | { kind: 'new-rule' }>;

export type FlatTreeItem =
  | { kind: 'app'; key: string; owner: TriggerOwner; label: string; depth: number; draggable: false; droppable: true }
  | { kind: 'highlight'; key: string; trigger: HighlightRule; owner: TriggerOwner; label: string; depth: number; draggable: true; droppable: true }
  | { kind: 'rule'; key: string; trigger: Rule; owner: TriggerOwner; label: string; depth: number; draggable: true; droppable: true }
  | { kind: 'world'; key: string; world: WorldRecord; owner: TriggerOwner; label: string; depth: number; draggable: false; droppable: true }
  | { kind: 'character'; key: string; character: CharacterRecord; owner: TriggerOwner; label: string; depth: number; draggable: false; droppable: true };

export function buildFlatTreeItems(
  triggers: Trigger[],
  worlds: WorldRecord[],
  characters: CharacterRecord[],
): FlatTreeItem[] {
  const items: FlatTreeItem[] = [
    {
      kind: 'app',
      key: 'app',
      owner: APP_TRIGGER_OWNER,
      label: 'app',
      depth: 0,
      draggable: false,
      droppable: true,
    },
  ];

  items.push(...getFlatTriggerItemsForOwner(triggers, APP_TRIGGER_OWNER, 1));

  for (const world of worlds) {
    const worldOwner: TriggerOwner = { kind: 'world', worldId: world.id };
    items.push({
      kind: 'world',
      key: getSelectionKey({ kind: 'world', worldId: world.id }),
      world,
      owner: worldOwner,
      label: world.name,
      depth: 1,
      draggable: false,
      droppable: true,
    });
    items.push(...getFlatTriggerItemsForOwner(triggers, worldOwner, 2));

    for (const character of characters.filter((entry) => entry.worldId === world.id)) {
      const characterOwner: TriggerOwner = { kind: 'character', characterId: character.id };
      items.push({
        kind: 'character',
        key: getCharacterSelectionKey(character.id),
        character,
        owner: characterOwner,
        label: character.name,
        depth: 2,
        draggable: false,
        droppable: true,
      });
      items.push(...getFlatTriggerItemsForOwner(triggers, characterOwner, 3));
    }
  }

  return items;
}

export function getCharacterSelectionKey(characterId: string): string {
  return `character-${characterId}`;
}

export function getTriggerSelectionKey(id: string): string {
  return `trigger-${id}`;
}

export function getSelectionKey(item: SelectableTreeSelection): string {
  if (item.kind === 'app') {
    return 'app';
  }

  if (item.kind === 'highlight' || item.kind === 'rule') {
    return getTriggerSelectionKey(item.id);
  }

  if (item.kind === 'world') {
    return `world-${item.worldId}`;
  }

  return getCharacterSelectionKey(item.characterId);
}

export function getOwnerFromFlatItem(item: FlatTreeItem | null): TriggerOwner | null {
  if (!item) {
    return null;
  }

  if (item.kind === 'app') {
    return APP_TRIGGER_OWNER;
  }

  if (item.kind === 'world') {
    return { kind: 'world', worldId: item.world.id };
  }

  if (item.kind === 'character') {
    return { kind: 'character', characterId: item.character.id };
  }

  return item.owner;
}

export function getNodeSelection(item: FlatTreeItem): SelectableTreeSelection {
  if (item.kind === 'app') {
    return { kind: 'app' };
  }

  if (item.kind === 'world') {
    return { kind: 'world', worldId: item.world.id };
  }

  if (item.kind === 'character') {
    return { kind: 'character', characterId: item.character.id };
  }

  if (item.kind === 'highlight') {
    return { kind: 'highlight', id: item.trigger.id };
  }

  return { kind: 'rule', id: item.trigger.id };
}

export function getNodeIcon(item: FlatTreeItem): string {
  if (item.kind === 'app') {
    return 'a';
  }

  if (item.kind === 'world') {
    return '▸';
  }

  if (item.kind === 'character') {
    return '•';
  }

  return item.kind === 'highlight' ? 'w' : 'r';
}

export function getNodeClasses(item: FlatTreeItem): string {
  const classes = ['triggers-tree-item'];
  if (item.draggable) {
    classes.push('triggers-tree-item--draggable');
  }
  if (item.kind === 'app') {
    classes.push('triggers-tree-item--app');
  } else if (item.kind === 'world') {
    classes.push('triggers-tree-item--world');
  } else if (item.kind === 'character') {
    classes.push('triggers-tree-item--character');
  }

  return classes.join(' ');
}

export function getFirstTriggerIdForOwnerAndType(
  items: FlatTreeItem[],
  owner: TriggerOwner,
  type: Trigger['type'],
): string | null {
  const first = items.find(
    (item) =>
      (item.kind === 'highlight' || item.kind === 'rule') &&
      item.trigger.type === type &&
      triggerOwnerEquals(item.owner, owner),
  );

  return first && (first.kind === 'highlight' || first.kind === 'rule') ? first.trigger.id : null;
}

export function getFirstFollowingTriggerIdForOwnerAndType(
  items: FlatTreeItem[],
  startIndex: number,
  owner: TriggerOwner,
  type: Trigger['type'],
): string | null {
  const following = items.slice(Math.max(0, startIndex)).find(
    (item) =>
      (item.kind === 'highlight' || item.kind === 'rule') &&
      item.trigger.type === type &&
      triggerOwnerEquals(item.owner, owner),
  );

  return following && (following.kind === 'highlight' || following.kind === 'rule') ? following.trigger.id : null;
}

function getFlatTriggerItemsForOwner(triggers: Trigger[], owner: TriggerOwner, depth: number): FlatTreeItem[] {
  return [
    ...getOwnerTriggers(triggers, owner).filter((trigger): trigger is HighlightRule => trigger.type === 'highlight'),
    ...getOwnerTriggers(triggers, owner).filter((trigger): trigger is Rule => trigger.type === 'rule'),
  ].map((trigger) => {
    if (trigger.type === 'highlight') {
      return {
        kind: 'highlight',
        key: getTriggerSelectionKey(trigger.id),
        trigger,
        owner,
        label: trigger.pattern || 'highlight',
        depth,
        draggable: true,
        droppable: true,
      };
    }

    return {
      kind: 'rule',
      key: getTriggerSelectionKey(trigger.id),
      trigger,
      owner,
      label: trigger.label || trigger.pattern || 'rule',
      depth,
      draggable: true,
      droppable: true,
    };
  });
}
