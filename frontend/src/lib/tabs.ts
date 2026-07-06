export type AppTabKind = 'characters' | 'settings' | 'world';

export const CHARACTERS_TAB_ID = 'characters';
export const SETTINGS_TAB_ID = 'settings';

export interface AppTabBase {
  id: string;
  kind: AppTabKind;
  title: string;
  closable: boolean;
}

export interface CharactersTab extends AppTabBase {
  kind: 'characters';
}

export interface SettingsTab extends AppTabBase {
  kind: 'settings';
}

export interface WorldTab extends AppTabBase {
  kind: 'world';
  worldId: string;
  characterId: string;
  connectionId: string;
}

export type AppTab = CharactersTab | SettingsTab | WorldTab;

export function createCharactersTab(): CharactersTab {
  return {
    id: CHARACTERS_TAB_ID,
    kind: 'characters',
    title: 'characters',
    closable: true,
  };
}

export function createSettingsTab(): SettingsTab {
  return {
    id: SETTINGS_TAB_ID,
    kind: 'settings',
    title: 'app settings',
    closable: true,
  };
}

export function createWorldTab(
  id: string,
  worldId: string,
  characterId: string,
  title: string,
  connectionId: string,
): WorldTab {
  return {
    id,
    kind: 'world',
    title,
    closable: true,
    worldId,
    characterId,
    connectionId,
  };
}
