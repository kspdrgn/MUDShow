import type { CharacterRecord, Trigger, TriggerOwner } from './types';

export const APP_TRIGGER_OWNER: TriggerOwner = { kind: 'app' };

export function createTriggerId(): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `trigger-${uuid}` : `trigger-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function triggerOwnerEquals(left: TriggerOwner, right: TriggerOwner): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === 'world' && right.kind === 'world') {
    return left.worldId === right.worldId;
  }

  if (left.kind === 'character' && right.kind === 'character') {
    return left.characterId === right.characterId;
  }

  return true;
}

export function getOwnerTriggers(triggers: Trigger[], owner: TriggerOwner): Trigger[] {
  return triggers.filter((trigger) => triggerOwnerEquals(trigger.owner, owner));
}

export function getTriggersForCharacter(triggers: Trigger[], character: CharacterRecord): Trigger[] {
  return [
    ...getOwnerTriggers(triggers, { kind: 'character', characterId: character.id }),
    ...getOwnerTriggers(triggers, { kind: 'world', worldId: character.worldId }),
    ...getOwnerTriggers(triggers, APP_TRIGGER_OWNER),
  ];
}

export function getTriggerOwnerLabel(owner: TriggerOwner): string {
  if (owner.kind === 'app') {
    return 'app';
  }

  if (owner.kind === 'world') {
    return 'world';
  }

  return 'character';
}

export function canCharacterOwnTriggers(character: CharacterRecord): boolean {
  return !character.isDefault;
}
