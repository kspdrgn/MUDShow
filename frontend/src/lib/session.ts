import { get, writable } from 'svelte/store';
import { MudConnection } from './connection';
import { buildHighlightRegexes } from './formatting';
import { createCharacterActions } from './session-character-actions';
import { createInitialState, type SessionState } from './session-state';
import { createPlaybackActions } from './session-playback-actions';
import { focusElement, nextFrame } from './session-dom';
import { loadSessionData } from './storage';
import type { CharacterRecord, WorldRecord } from './types';
import {
  CHARACTERS_TAB_ID,
  SETTINGS_TAB_ID,
  createCharactersTab,
  createSettingsTab,
  createWorldTab,
  type AppTab,
  type WorldTab,
} from './tabs';
import {
  applyWorldProjection,
  createWorldTabSessionState,
  type WorldTabSessionState,
} from './world-session';
import { getWorldDomScope, getWorldInputBarInputId } from './world-dom';

function createSession() {
  const state = writable<SessionState>(createInitialState());
  let highlightRegexes = buildHighlightRegexes(get(state).highlights);
  let nextWorldTabId = 1;
  let nextConnectionId = 1;
  const worldConnections = new Map<string, MudConnection>();
  let clearLoggingQueue = (_tabId: string): void => {};

  const getState = () => get(state);
  const patch = (partial: Partial<SessionState>) => {
    state.update((current) => ({
      ...current,
      ...partial,
    }));
  };

  function getTab(tabId: string): AppTab | null {
    return getState().tabs.find((tab) => tab.id === tabId) ?? null;
  }

  function getActiveTab(stateSnapshot = getState()): AppTab | null {
    if (stateSnapshot.activeTabId === null) {
      return null;
    }

    return stateSnapshot.tabs.find((tab) => tab.id === stateSnapshot.activeTabId) ?? null;
  }

  function getActiveWorldTabId(stateSnapshot = getState()): string | null {
    const activeTab = getActiveTab(stateSnapshot);
    return activeTab?.kind === 'world' ? activeTab.id : null;
  }

  function getWorldSessions(stateSnapshot = getState()): Record<string, WorldTabSessionState> {
    return stateSnapshot.worldSessions;
  }

  function getWorldSession(tabId: string): WorldTabSessionState {
    return getWorldSessions()[tabId] ?? createWorldTabSessionState();
  }

  function resetPersistentView(): void {
    const current = getState();
    const nextTabs = current.tabs.filter((tab) => tab.kind !== 'world');
    const activeTabStillExists = current.activeTabId !== null && nextTabs.some((tab) => tab.id === current.activeTabId);

    for (const tab of current.tabs) {
      if (tab.kind === 'world') {
        releaseWorldConnection(tab.id);
        clearLoggingQueue(tab.id);
      }
    }

    state.set({
      ...current,
      worlds: [],
      characters: [],
      highlights: [],
      tabs: nextTabs,
      activeTabId: activeTabStillExists ? current.activeTabId : nextTabs[0]?.id ?? null,
      worldSessions: {},
      modalOpen: false,
      modalKind: null,
      modalTitle: 'add character',
      closeConfirmTabId: null,
      closeConfirmMode: null,
      worldEditingId: null,
      worldModalDraft: { ...createInitialState().worldModalDraft },
      editingIndex: null,
      modalDraft: { ...createInitialState().modalDraft },
      characterWorldId: null,
    });
    highlightRegexes = buildHighlightRegexes([]);
    nextWorldTabId = 1;
    nextConnectionId = 1;
  }

  function ensureWorldSession(tabId: string): WorldTabSessionState {
    const existing = getWorldSession(tabId);
    if (getWorldSessions()[tabId]) {
      return existing;
    }

    const created = createWorldTabSessionState();
    state.update((current) => ({
      ...current,
      worldSessions: {
        ...current.worldSessions,
        [tabId]: created,
      },
    }));
    return created;
  }

  function updateWorldSession(tabId: string, patch: Partial<WorldTabSessionState>): void {
    state.update((current) => {
      const existing = current.worldSessions[tabId] ?? createWorldTabSessionState();
      const next = applyWorldProjection(existing, patch);

      return {
        ...current,
        worldSessions: {
          ...current.worldSessions,
          [tabId]: next,
        },
      };
    });
  }

  function setWorldOutput(tabId: string, outputChunks: string[], outputEndsWithBr: boolean): void {
    state.update((current) => {
      const existing = current.worldSessions[tabId] ?? createWorldTabSessionState();

      return {
        ...current,
        worldSessions: {
          ...current.worldSessions,
          [tabId]: {
            ...existing,
            outputChunks,
            outputEndsWithBr,
            outputRevision: existing.outputRevision + 1,
          },
        },
      };
    });
  }

  function ensureSpecialTab(kind: 'characters' | 'settings'): AppTab {
    const current = getState();
    const existing = current.tabs.find((tab) => tab.id === (kind === 'characters' ? CHARACTERS_TAB_ID : SETTINGS_TAB_ID));

    if (existing) {
      return existing;
    }

    const tab = kind === 'characters' ? createCharactersTab() : createSettingsTab();

    state.update((snapshot) => ({
      ...snapshot,
      tabs: [...snapshot.tabs, tab],
    }));

    return tab;
  }

  function getWorldConnection(tabId: string): MudConnection | null {
    const tab = getTab(tabId);
    if (!tab || tab.kind !== 'world') {
      return null;
    }

    let connection = worldConnections.get(tabId);
    if (!connection) {
      connection = new MudConnection(tab.connectionId);
      worldConnections.set(tabId, connection);
    }

    return connection;
  }

  function releaseWorldConnection(tabId: string): void {
    const connection = worldConnections.get(tabId);
    worldConnections.delete(tabId);
    if (connection) {
      void connection.close();
    }
  }

  async function closeWorldTabConnection(tabId: string): Promise<void> {
    const connection = worldConnections.get(tabId);
    if (!connection) {
      return;
    }

    await connection.close();
  }

  function shouldConfirmWorldTabClose(tabId: string): boolean {
    const tab = getTab(tabId);
    if (!tab || tab.kind !== 'world') {
      return false;
    }

    const session = getWorldSession(tabId);
    return session.connectionStatus === 'connected' || session.connectionStatus === 'connecting';
  }

  function closeTabImmediately(tabId: string): void {
    const current = getState();
    const tab = current.tabs.find((item) => item.id === tabId);

    if (!tab || !tab.closable) {
      return;
    }

    const nextTabs = current.tabs.filter((item) => item.id !== tabId);
    const nextWorldSessions = { ...current.worldSessions };
    delete nextWorldSessions[tabId];

    if (tab.kind === 'world') {
      releaseWorldConnection(tab.id);
    }

    clearLoggingQueue(tab.id);

    const nextActiveTabId =
      current.activeTabId === tabId
        ? nextTabs.find((item) => item.kind === 'world')?.id ??
          nextTabs.find((item) => item.id === SETTINGS_TAB_ID)?.id ??
          nextTabs.find((item) => item.id === CHARACTERS_TAB_ID)?.id ??
          nextTabs[0]?.id ??
          null
        : current.activeTabId;

    state.set({
      ...current,
      tabs: nextTabs,
      activeTabId: nextActiveTabId,
      worldSessions: nextWorldSessions,
      closeConfirmTabId: null,
    });
  }

  function activateWorldTab(tabId: string): void {
    ensureWorldSession(tabId);
    state.update((current) => ({
      ...current,
      activeTabId: tabId,
      modalOpen: false,
      modalKind: null,
    }));
  }

  async function focusActiveWorldInputBar(tabId: string): Promise<void> {
    await nextFrame();

    const session = getWorldSession(tabId);
    focusElement(getWorldInputBarInputId(getWorldDomScope(tabId), session.activeBar));
  }

  function selectTab(tabId: string): void {
    const tab = getTab(tabId);
    if (!tab) {
      if (tabId === CHARACTERS_TAB_ID || tabId === SETTINGS_TAB_ID) {
        const specialTab = ensureSpecialTab(tabId === CHARACTERS_TAB_ID ? 'characters' : 'settings');
        patch({ activeTabId: specialTab.id, modalOpen: false, modalKind: null });
      }
      return;
    }

    if (tab.kind === 'world') {
      activateWorldTab(tabId);
      void focusActiveWorldInputBar(tabId);
      return;
    }

    patch({
      activeTabId: tabId,
      modalOpen: false,
      modalKind: null,
    });
  }

  function selectNextTab(): void {
    const current = getState();
    if (current.tabs.length === 0) {
      return;
    }

    const activeIndex = current.activeTabId === null
      ? -1
      : current.tabs.findIndex((tab) => tab.id === current.activeTabId);
    const nextTab = current.tabs[(activeIndex + 1) % current.tabs.length] ?? current.tabs[0] ?? null;

    if (!nextTab) {
      return;
    }

    selectTab(nextTab.id);
  }

  function selectPreviousTab(): void {
    const current = getState();
    if (current.tabs.length === 0) {
      return;
    }

    const activeIndex = current.activeTabId === null
      ? -1
      : current.tabs.findIndex((tab) => tab.id === current.activeTabId);
    const previousIndex = activeIndex <= 0 ? current.tabs.length - 1 : activeIndex - 1;
    const previousTab = current.tabs[previousIndex] ?? current.tabs[0] ?? null;

    if (!previousTab) {
      return;
    }

    selectTab(previousTab.id);
  }

  async function openCharactersTab(): Promise<void> {
    selectTab(CHARACTERS_TAB_ID);
    await nextFrame();
  }

  function reorderTab(tabId: string, targetIndex: number): void {
    const current = getState();
    const currentIndex = current.tabs.findIndex((tab) => tab.id === tabId);

    if (currentIndex < 0) {
      return;
    }

    const nextTabs = [...current.tabs];
    const [tab] = nextTabs.splice(currentIndex, 1);
    const nextIndex = Math.max(0, Math.min(targetIndex, nextTabs.length));

    nextTabs.splice(nextIndex, 0, tab);

    state.set({
      ...current,
      tabs: nextTabs,
      activeTabId: current.activeTabId,
    });
  }

  function refreshWorldTabs(): void {
    state.update((current) => {
      const worldById = new Map(current.worlds.map((world) => [world.id, world]));
      const characterById = new Map(current.characters.map((character) => [character.id, character]));

      const tabs = current.tabs.map((tab) => {
        if (tab.kind !== 'world') {
          return tab;
        }

        const character = characterById.get(tab.characterId);
        const world = character ? worldById.get(character.worldId) : worldById.get(tab.worldId);

        if (!world || !character) {
          return tab;
        }

        return {
          ...tab,
          worldId: world.id,
          title: `${world.name} · ${character.name}`,
        };
      });

      const worldSessions: Record<string, WorldTabSessionState> = {};
      for (const [tabId, session] of Object.entries(current.worldSessions)) {
        const tab = tabs.find((item): item is WorldTab => item.kind === 'world' && item.id === tabId);
        if (!tab) {
          worldSessions[tabId] = session;
          continue;
        }

        const character = characterById.get(tab.characterId);
        const world = character ? worldById.get(character.worldId) ?? null : worldById.get(tab.worldId) ?? null;
        worldSessions[tabId] = {
          ...session,
          currentWorld: world,
          currentCharacter: character ?? null,
        };
      }

      return {
        ...current,
        tabs,
        worldSessions,
      };
    });
  }

  function ensureWorldTab(world: WorldRecord, character: CharacterRecord): string {
    const current = getState();
    const existing = current.tabs.find(
      (tab): tab is WorldTab => tab.kind === 'world' && tab.worldId === world.id && tab.characterId === character.id,
    );

    if (existing) {
      ensureWorldSession(existing.id);
      patch({ activeTabId: existing.id });
      return existing.id;
    }

    const connectionId = `connection-${nextConnectionId++}`;
    const tab = createWorldTab(
      `world-${nextWorldTabId++}`,
      world.id,
      character.id,
      `${world.name} · ${character.name}`,
      connectionId,
    );
    const worldSession = createWorldTabSessionState();

    state.update((snapshot) => ({
      ...snapshot,
      tabs: [...snapshot.tabs, tab],
      activeTabId: tab.id,
      worldSessions: {
        ...snapshot.worldSessions,
        [tab.id]: {
          ...worldSession,
          currentWorld: world,
          currentCharacter: character,
        },
      },
    }));

    return tab.id;
  }

  function closeTab(tabId: string, source: 'mouse' | 'shortcut' = 'mouse'): void {
    if (shouldConfirmWorldTabClose(tabId)) {
      patch({
        closeConfirmTabId: tabId,
        closeConfirmMode: source === 'shortcut' ? 'modal' : 'dropdown',
        modalOpen: false,
        modalKind: null,
      });
      return;
    }

    closeTabImmediately(tabId);
  }

  function cancelCloseConfirm(): void {
    patch({ closeConfirmTabId: null, closeConfirmMode: null });
  }

  function confirmCloseTab(): void {
    const tabId = getState().closeConfirmTabId;
    if (!tabId) {
      return;
    }

    closeTabImmediately(tabId);
  }

  function deleteWorldTabsForCharacter(characterId: string): void {
    const current = getState();
    const removedTabs = current.tabs.filter(
      (tab): tab is WorldTab => tab.kind === 'world' && tab.characterId === characterId,
    );
    const nextTabs = current.tabs.filter((tab) => !(tab.kind === 'world' && tab.characterId === characterId));

    removedTabs.forEach((tab) => releaseWorldConnection(tab.id));
    removedTabs.forEach((tab) => clearLoggingQueue(tab.id));

    const nextWorldSessions: Record<string, WorldTabSessionState> = {};
    for (const [tabId, session] of Object.entries(current.worldSessions)) {
      if (!removedTabs.some((tab) => tab.id === tabId)) {
        nextWorldSessions[tabId] = session;
      }
    }

    const activeWasRemoved = removedTabs.some((tab) => tab.id === current.activeTabId);
    const nextActiveTabId = activeWasRemoved
      ? nextTabs.find((tab) => tab.kind === 'world')?.id ??
        nextTabs.find((tab) => tab.id === SETTINGS_TAB_ID)?.id ??
        nextTabs.find((tab) => tab.id === CHARACTERS_TAB_ID)?.id ??
        nextTabs[0]?.id ??
        null
      : current.activeTabId;

    state.set({
      ...current,
      tabs: nextTabs,
      activeTabId: nextActiveTabId,
      worldSessions: nextWorldSessions,
    });
  }

  function deleteWorldTabsForWorld(worldId: string): void {
    const current = getState();
    const removedTabs = current.tabs.filter((tab): tab is WorldTab => tab.kind === 'world' && tab.worldId === worldId);
    const nextTabs = current.tabs.filter((tab) => !(tab.kind === 'world' && tab.worldId === worldId));

    removedTabs.forEach((tab) => releaseWorldConnection(tab.id));
    removedTabs.forEach((tab) => clearLoggingQueue(tab.id));

    const nextWorldSessions: Record<string, WorldTabSessionState> = {};
    for (const [tabId, session] of Object.entries(current.worldSessions)) {
      if (!removedTabs.some((tab) => tab.id === tabId)) {
        nextWorldSessions[tabId] = session;
      }
    }

    const activeWasRemoved = removedTabs.some((tab) => tab.id === current.activeTabId);
    const nextActiveTabId = activeWasRemoved
      ? nextTabs.find((tab) => tab.kind === 'world')?.id ??
        nextTabs.find((tab) => tab.id === SETTINGS_TAB_ID)?.id ??
        nextTabs.find((tab) => tab.id === CHARACTERS_TAB_ID)?.id ??
        nextTabs[0]?.id ??
        null
      : current.activeTabId;

    state.set({
      ...current,
      tabs: nextTabs,
      activeTabId: nextActiveTabId,
      worldSessions: nextWorldSessions,
    });
  }

  const load = async () => {
    try {
      resetPersistentView();
      const { worlds, characters, highlights } = await loadSessionData();
      patch({ worlds, characters, highlights });
      highlightRegexes = buildHighlightRegexes(highlights);
      refreshWorldTabs();
    } catch (error) {
      console.error('failed to load persisted session data:', error);
    }
  };

  const characterActions = createCharacterActions({
    state,
    getState,
    patch,
    onRecordsChanged: refreshWorldTabs,
    onWorldDeleted: deleteWorldTabsForWorld,
    onCharacterDeleted: deleteWorldTabsForCharacter,
  });

  const playbackActions = createPlaybackActions({
    state,
    getState,
    patch,
    getActiveWorldTabId,
    getWorldSession,
    ensureWorldSession,
    updateWorldSession,
    setWorldOutput,
    activateWorldTab,
    getWorldConnection,
    closeWorldTabConnection,
    closeTab,
    getHighlightRegexes: () => highlightRegexes,
    setHighlightRegexes: (regexes) => {
      highlightRegexes = regexes;
    },
    ensureWorldTab,
  });

  clearLoggingQueue = playbackActions.clearLoggingQueue;

  async function openWorldEditorFromWorldTab(tabId: string): Promise<void> {
    const session = getWorldSession(tabId);
    const world = session.currentWorld;
    if (!world) {
      return;
    }

    const worldIndex = getState().worlds.findIndex((entry) => entry.id === world.id);
    if (worldIndex < 0) {
      return;
    }

    await openCharactersTab();
    await characterActions.openWorldModal(worldIndex);
  }

  async function openCharacterEditorFromWorldTab(tabId: string): Promise<void> {
    const session = getWorldSession(tabId);
    const character = session.currentCharacter;
    if (!character || character.isDefault) {
      return;
    }

    const characterIndex = getState().characters.findIndex((entry) => entry.id === character.id);
    if (characterIndex < 0) {
      return;
    }

    await openCharactersTab();
    await characterActions.openCharacterModal(character.worldId, characterIndex);
  }

  return {
    subscribe: state.subscribe,
    load,
    dispose: () => {
      for (const tabId of [...worldConnections.keys()]) {
        releaseWorldConnection(tabId);
      }
    },
    selectTab,
    selectNextTab,
    selectPreviousTab,
    reorderTab,
    closeTab,
    cancelCloseConfirm,
    confirmCloseTab,
    ensureWorldTab,
    getWorldSession,
    getWorldConnection,
    refreshWorldTabs,
    deleteWorldTabsForCharacter,
    deleteWorldTabsForWorld,
    openWorldEditorFromWorldTab,
    openCharacterEditorFromWorldTab,
    ...characterActions,
    ...playbackActions,
  };
}

export const session = createSession();
