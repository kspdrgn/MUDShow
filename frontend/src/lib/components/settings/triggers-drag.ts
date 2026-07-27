import type { Trigger, TriggerOwner } from '../../types';
import { APP_TRIGGER_OWNER, triggerOwnerEquals } from '../../triggers';
import type { FlatTreeItem } from './triggers-tree';
import {
  getFirstFollowingTriggerIdForOwnerAndType,
  getFirstTriggerIdForOwnerAndType,
  getOwnerFromFlatItem,
} from './triggers-tree';

export type PointerDragState = {
  pointerId: number;
  sourceNodeKey: string;
  triggerId: string;
  startX: number;
  startY: number;
  active: boolean;
};

export function createPointerDragState(
  item: FlatTreeItem,
  event: PointerEvent,
): PointerDragState | null {
  if (!item.draggable || (item.kind !== 'highlight' && item.kind !== 'rule') || event.button !== 0) {
    return null;
  }

  return {
    pointerId: event.pointerId,
    sourceNodeKey: item.key,
    triggerId: item.trigger.id,
    startX: event.clientX,
    startY: event.clientY,
    active: false,
  };
}

export function getDropIndicatorIndexFromPoint(y: number): number {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('[data-trigger-tree-node-key]'));
  if (rows.length === 0) {
    return 0;
  }

  for (let index = 0; index < rows.length; index += 1) {
    const rect = rows[index].getBoundingClientRect();
    if (y < rect.top + rect.height / 2) {
      return index;
    }
  }

  return rows.length;
}

export function getDropPlanForIndicator(
  source: Trigger,
  sourceNodeKey: string,
  indicatorIndex: number,
  items: FlatTreeItem[],
): { owner: TriggerOwner; beforeTriggerId: string | null } | null {
  const sourceIndex = items.findIndex((item) => item.key === sourceNodeKey);
  const itemsWithoutSource = items.filter((item) => item.key !== sourceNodeKey);
  const insertionIndex = sourceIndex >= 0 && sourceIndex < indicatorIndex
    ? indicatorIndex - 1
    : indicatorIndex;
  const beforeItem = itemsWithoutSource[insertionIndex] ?? null;
  const previousItem = insertionIndex > 0 ? itemsWithoutSource[insertionIndex - 1] ?? null : null;
  const beforeItemIsSameTypeTrigger =
    beforeItem !== null &&
    (beforeItem.kind === 'highlight' || beforeItem.kind === 'rule') &&
    beforeItem.trigger.type === source.type;
  const ownerSource = beforeItemIsSameTypeTrigger
    ? beforeItem
    : previousItem ?? beforeItem;
  const owner = ownerSource ? getOwnerFromFlatItem(ownerSource) : APP_TRIGGER_OWNER;

  if (!owner) {
    return null;
  }

  if (beforeItemIsSameTypeTrigger && triggerOwnerEquals(beforeItem.owner, owner)) {
    return { owner, beforeTriggerId: beforeItem.trigger.id };
  }

  const firstFollowingSameTypeTriggerId = getFirstFollowingTriggerIdForOwnerAndType(
    itemsWithoutSource,
    insertionIndex,
    owner,
    source.type,
  );
  if (firstFollowingSameTypeTriggerId) {
    return { owner, beforeTriggerId: firstFollowingSameTypeTriggerId };
  }

  if (
    beforeItem &&
    ownerSource === beforeItem &&
    (beforeItem.kind === 'app' || beforeItem.kind === 'world' || beforeItem.kind === 'character')
  ) {
    return {
      owner,
      beforeTriggerId: getFirstTriggerIdForOwnerAndType(itemsWithoutSource, owner, source.type),
    };
  }

  return { owner, beforeTriggerId: null };
}
