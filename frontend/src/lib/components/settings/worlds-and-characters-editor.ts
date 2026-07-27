import type { CharacterRecord, WorldRecord } from '../../types';

export type DeleteTarget =
  | { kind: 'world'; index: number; worldName: string }
  | { kind: 'character'; index: number; characterName: string };

export type MenuTarget =
  | { kind: 'world'; index: number; world: WorldRecord }
  | { kind: 'character'; index: number; character: CharacterRecord };

export interface WorldCharacterRow {
  character: CharacterRecord;
  characterIndex: number;
}

export interface WorldRowModel {
  world: WorldRecord;
  worldIndex: number;
  characters: WorldCharacterRow[];
}

export function getWorldCharacters(worldId: string, characters: CharacterRecord[]): CharacterRecord[] {
  return characters.filter((character) => character.worldId === worldId);
}

export function buildWorldRows(
  worlds: WorldRecord[],
  characters: CharacterRecord[],
): WorldRowModel[] {
  return worlds.map((world, worldIndex) => ({
    world,
    worldIndex,
    characters: characters
      .map((character, characterIndex) => ({ character, characterIndex }))
      .filter(({ character }) => character.worldId === world.id),
  }));
}

export function clampMenuPosition(
  position: { x: number; y: number },
  menuElement: HTMLElement,
  windowSize: { width: number; height: number },
  margin = 8,
): { x: number; y: number } {
  const rect = menuElement.getBoundingClientRect();
  const maxX = windowSize.width - rect.width - margin;
  const maxY = windowSize.height - rect.height - margin;

  return {
    x: Math.max(margin, Math.min(position.x, maxX)),
    y: Math.max(margin, Math.min(position.y, maxY)),
  };
}

export function createWorldDeleteTarget(index: number, world: WorldRecord | undefined): DeleteTarget | null {
  if (!world) {
    return null;
  }

  return {
    kind: 'world',
    index,
    worldName: world.name,
  };
}

export function createCharacterDeleteTarget(index: number, character: CharacterRecord | undefined): DeleteTarget | null {
  if (!character) {
    return null;
  }

  return {
    kind: 'character',
    index,
    characterName: character.name,
  };
}
