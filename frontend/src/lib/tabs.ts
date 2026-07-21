export type AppTabKind = 'characters' | 'settings' | 'triggers' | 'world';
export type SettingsSubTabId =
  | 'database'
  | 'window'
  | 'transcript'
  | 'logging'
  | 'connections'
  | 'spellcheck'
  | 'style'
  | 'ui';

export const CHARACTERS_TAB_ID = 'characters';
export const SETTINGS_TAB_ID = 'settings';
export const TRIGGERS_TAB_ID = 'triggers';

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

export interface TriggersTab extends AppTabBase {
  kind: 'triggers';
}

export interface WorldTab extends AppTabBase {
  kind: 'world';
  worldId: string;
  characterId: string | null;
  connectionId: string;
}

export type AppTab = CharactersTab | SettingsTab | TriggersTab | WorldTab;

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

export function createTriggersTab(): TriggersTab {
  return {
    id: TRIGGERS_TAB_ID,
    kind: 'triggers',
    title: 'triggers',
    closable: true,
  };
}

export function createWorldTab(
  id: string,
  worldId: string,
  characterId: string | null,
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
