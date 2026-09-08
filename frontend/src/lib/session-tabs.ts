import type { Writable } from 'svelte/store';
import { appServices } from './app-services';
import { buildHighlightRegexes } from './formatting';
import { DEFAULT_TRANSCRIPT_SCROLLBACK_CHUNKS } from './playback';
import { focusElement, nextFrame } from './session-dom';
import type { HighlightRule, WorldRecord, CharacterRecord } from './types';
import {
  CHARACTERS_TAB_ID,
  SETTINGS_TAB_ID,
  TRIGGERS_TAB_ID,
  createCharactersTab,
  createSettingsTab,
  createTriggersTab,
  createWorldTab,
  type AppTab,
  type WorldTab,
} from './tabs';
import {
  applyWorldProjection,
  createWorldTabSessionState,
  type WorldTabSessionState,
} from './world-session';
import { createWorldSessionKey, type WorldSessionContainerRegistry } from './world-session-container';
import { getWorldDomScope, getWorldInputBarInputId } from './world-dom';
import { createInitialState, type SessionState } from './session-state';
import { cancelPendingNotesSave, clearWorldNotes, flushPendingNotesSave, setWorldNotes } from './session-world-input';
import { loadNotes } from './storage';

interface SessionTabsActionContext {
  state: Writable<SessionState>;
  getState: () => SessionState;
  patch: (patch: Partial<SessionState>) => void;
  setHighlightRegexes: (regexes: ReturnType<typeof buildHighlightRegexes>) => void;
  clearLoggingQueue: (tabId: string) => void;
  worldSessionContainers: WorldSessionContainerRegistry;
}

export function createSessionTabsActions({
  state,
  getState,
  patch,
  setHighlightRegexes,
  clearLoggingQueue,
  worldSessionContainers,
}: SessionTabsActionContext) {
  let nextWorldTabId = 1;
  let nextConnectionId = 1;
  let transcriptScrollbackChunks = DEFAULT_TRANSCRIPT_SCROLLBACK_CHUNKS;

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
    return getWorldSessions()[tabId] ?? createWorldTabSessionState(transcriptScrollbackChunks);
  }

  function syncWorldSessionContainer(
    worldId: string,
    characterId: string | null,
  ): void {
    const key = createWorldSessionKey(worldId, characterId);
    worldSessionContainers.container.ensure(key);
  }

  function clearWorldSessionContainer(worldId: string, characterId: string | null): void {
    worldSessionContainers.container.delete(createWorldSessionKey(worldId, characterId));
  }

  function ensureWorldSession(tabId: string): WorldTabSessionState {
    const existing = getWorldSession(tabId);
    if (getWorldSessions()[tabId]) {
      return existing;
    }

    const created = createWorldTabSessionState(transcriptScrollbackChunks);
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
      const existing = current.worldSessions[tabId] ?? createWorldTabSessionState(transcriptScrollbackChunks);
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

  function ensureSpecialTab(kind: 'characters' | 'settings' | 'triggers'): AppTab {
    const current = getState();
    const existing = current.tabs.find((tab) =>
      tab.id ===
      (kind === 'characters'
        ? CHARACTERS_TAB_ID
        : kind === 'settings'
          ? SETTINGS_TAB_ID
          : TRIGGERS_TAB_ID),
    );

    if (existing) {
      return existing;
    }

    const tab =
      kind === 'characters'
        ? createCharactersTab()
        : kind === 'settings'
          ? createSettingsTab()
          : createTriggersTab();

    state.update((snapshot) => ({
      ...snapshot,
      tabs: [...snapshot.tabs, tab],
    }));

    return tab;
  }

  function shouldConfirmWorldTabClose(tabId: string): boolean {
    const tab = getTab(tabId);
    if (!tab || tab.kind !== 'world') {
      return false;
    }

    const session = getWorldSession(tabId);
    return session.connectionStatus === 'connected' || session.connectionStatus === 'connecting';
  }

  function shouldConfirmUnloggedWorldTabClose(tabId: string): boolean {
    if (!getState().confirmUnloggedTabClose) {
      return false;
    }

    const tab = getTab(tabId);
    if (!tab || tab.kind !== 'world') {
      return false;
    }

    const session = getWorldSession(tabId);
    return (
      !session.loggingActive &&
      session.connectionStatus !== 'connected' &&
      session.connectionStatus !== 'connecting'
    );
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
      flushPendingNotesSave(tab.id);
      clearWorldNotes(tab.id);
      clearWorldSessionContainer(tab.worldId, tab.characterId);
    }

    if (tab.kind === 'settings') {
      patch({ settingsActiveTab: 'database' });
    }

    clearLoggingQueue(tab.id);

    const nextActiveTabId =
      current.activeTabId === tabId
        ? nextTabs.find((item) => item.kind === 'world')?.id ??
          nextTabs.find((item) => item.id === TRIGGERS_TAB_ID)?.id ??
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
      worldSessions: {
        ...current.worldSessions,
        [tabId]: applyWorldProjection(
          current.worldSessions[tabId] ?? createWorldTabSessionState(transcriptScrollbackChunks),
          { hasNewActivity: false },
        ),
      },
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
      if (tabId === CHARACTERS_TAB_ID || tabId === SETTINGS_TAB_ID || tabId === TRIGGERS_TAB_ID) {
        const specialTab =
          ensureSpecialTab(
            tabId === CHARACTERS_TAB_ID
              ? 'characters'
              : tabId === SETTINGS_TAB_ID
                ? 'settings'
                : 'triggers',
          );
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

  function openTriggersTab(worldId: string | null = null, characterId: string | null = null): void {
    const triggersTab = ensureSpecialTab('triggers');
    patch({
      activeTabId: triggersTab.id,
      modalOpen: false,
      modalKind: null,
      triggersContextWorldId: worldId,
      triggersContextCharacterId: characterId,
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

        const character = tab.characterId ? characterById.get(tab.characterId) ?? null : null;
        const world = character ? worldById.get(character.worldId) : worldById.get(tab.worldId);

        if (!world) {
          return tab;
        }

        return {
          ...tab,
          worldId: world.id,
          title: character ? `${world.name} · ${character.name}` : world.name,
        };
      });

      const worldSessions: Record<string, WorldTabSessionState> = {};
      for (const [tabId, session] of Object.entries(current.worldSessions)) {
        const tab = tabs.find((item): item is WorldTab => item.kind === 'world' && item.id === tabId);
        if (!tab) {
          worldSessions[tabId] = session;
          continue;
        }

        const character = tab.characterId ? characterById.get(tab.characterId) ?? null : null;
        const world = character ? worldById.get(character.worldId) ?? null : worldById.get(tab.worldId) ?? null;
        syncWorldSessionContainer(world?.id ?? tab.worldId, character?.id ?? tab.characterId);
        worldSessions[tabId] = {
          ...session,
          currentWorld: world,
          currentCharacter: character,
        };
      }

      return {
        ...current,
        tabs,
        worldSessions,
      };
    });
  }

  function ensureWorldTab(
    world: WorldRecord,
    character: CharacterRecord | null = null,
    connectionId: string | null = null,
  ): string {
    const current = getState();
    const existing = current.tabs.find(
      (tab): tab is WorldTab =>
        tab.kind === 'world' &&
        tab.worldId === world.id &&
        tab.characterId === (character?.id ?? null),
    );

    if (existing) {
      ensureWorldSession(existing.id);
      syncWorldSessionContainer(world.id, character?.id ?? null);
      patch({ activeTabId: existing.id });
      return existing.id;
    }

    const tabConnectionId = connectionId ?? `connection-${nextConnectionId++}`;
    const tab = createWorldTab(
      `world-${nextWorldTabId++}`,
      world.id,
      character?.id ?? null,
      character ? `${world.name} · ${character.name}` : world.name,
      tabConnectionId,
    );
    const worldSession = createWorldTabSessionState(transcriptScrollbackChunks);

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

    syncWorldSessionContainer(world.id, character?.id ?? null);

    return tab.id;
  }

  function closeTab(tabId: string, source: 'mouse' | 'shortcut' = 'mouse'): void {
    if (shouldConfirmWorldTabClose(tabId) || shouldConfirmUnloggedWorldTabClose(tabId)) {
      if (source === 'shortcut') {
        const current = getState();
        const tab = current.tabs.find((entry) => entry.id === tabId) ?? null;
        const sessionState = current.worldSessions[tabId];
        const worldName =
          sessionState?.currentWorld?.name ??
          sessionState?.currentCharacter?.name ??
          tab?.title ??
          'this world';
        const isConnected =
          sessionState?.connectionStatus === 'connected' ||
          sessionState?.connectionStatus === 'connecting';

        void appServices.notice.confirm({
          surfaceId: 'world-close-confirm',
          title: 'close world tab?',
          message: isConnected
            ? `World ${worldName} is connected. Disconnect and close?`
            : `World ${worldName} is not being logged. Close anyway?`,
          confirmLabel: isConnected ? 'disconnect and close' : 'close anyway',
          cancelLabel: 'cancel',
        }).then((accepted) => {
          if (accepted) {
            closeTabImmediately(tabId);
          }
        });

        patch({
          closeConfirmTabId: null,
          closeConfirmMode: null,
          modalOpen: false,
          modalKind: null,
        });
        return;
      }

      patch({
        closeConfirmTabId: tabId,
        closeConfirmMode: 'dropdown',
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

    removedTabs.forEach((tab) => cancelPendingNotesSave(tab.id));
    removedTabs.forEach((tab) => clearWorldNotes(tab.id));
    removedTabs.forEach((tab) => clearWorldSessionContainer(tab.worldId, tab.characterId));
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

    removedTabs.forEach((tab) => cancelPendingNotesSave(tab.id));
    removedTabs.forEach((tab) => clearWorldNotes(tab.id));
    removedTabs.forEach((tab) => clearWorldSessionContainer(tab.worldId, tab.characterId));
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

  function resetPersistentView(): void {
    const current = getState();
    const nextTabs = current.tabs.filter((tab) => tab.kind !== 'world');
    const activeTabStillExists = current.activeTabId !== null && nextTabs.some((tab) => tab.id === current.activeTabId);

    for (const tab of current.tabs) {
      if (tab.kind === 'world') {
        cancelPendingNotesSave(tab.id);
        clearWorldNotes(tab.id);
        clearWorldSessionContainer(tab.worldId, tab.characterId);
        clearLoggingQueue(tab.id);
      }
    }

    state.set({
      ...current,
      worlds: [],
      characters: [],
      triggers: [],
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
      triggersContextWorldId: null,
      triggersContextCharacterId: null,
    });
    setHighlightRegexes(buildHighlightRegexes([]));
    nextWorldTabId = 1;
    nextConnectionId = 1;
  }

  function setTranscriptScrollbackChunks(maxChunks: number): void {
    transcriptScrollbackChunks = Math.max(1, Math.round(maxChunks));

    state.update((current) => {
      const worldSessions: Record<string, WorldTabSessionState> = {};

      for (const [tabId, worldSession] of Object.entries(current.worldSessions)) {
        const previousChunkCount = worldSession.transcript.getChunkCount();
        worldSession.transcript.setMaxChunks(transcriptScrollbackChunks);
        const nextChunkCount = worldSession.transcript.getChunkCount();
        const firstChunk = worldSession.transcript.getChunk(0);
        const lastActivityMarker = worldSession.lastActivityMarker
          && firstChunk
          && worldSession.lastActivityMarker.boundary.chunkId < firstChunk.id
          ? null
          : worldSession.lastActivityMarker;

        worldSessions[tabId] = {
          ...worldSession,
          lastActivityMarker,
          outputRevision:
            nextChunkCount === previousChunkCount
              ? worldSession.outputRevision
              : worldSession.outputRevision + 1,
        };
      }

      return {
        ...current,
        worldSessions,
      };
    });
  }

  const load = async () => {
    try {
      resetPersistentView();
      const { worlds, characters, triggers } = await appServices.storage.loadSessionData();
      patch({ worlds, characters, triggers });
      setHighlightRegexes(buildHighlightRegexes(triggers.filter((trigger): trigger is HighlightRule => trigger.type === 'highlight')));
      const worldTabs = getState().tabs.filter((tab): tab is WorldTab => tab.kind === 'world' && tab.characterId !== null);

      await Promise.all(
        worldTabs.map(async (tab) => {
          const characterId = tab.characterId;
          if (!characterId) {
            return;
          }

          const notes = await loadNotes(characterId, false);
          setWorldNotes(tab.id, notes);
        }),
      );

      refreshWorldTabs();
    } catch (error) {
      console.error('failed to load persisted session data:', error);
    }
  };

  function dispose(): void {
    worldSessionContainers.container.clear();
  }

  return {
    getActiveWorldTabId,
    getWorldSession,
    ensureWorldSession,
    updateWorldSession,
    activateWorldTab,
    ensureWorldTab,
    refreshWorldTabs,
    selectTab,
    selectNextTab,
    selectPreviousTab,
    openTriggersTab,
    reorderTab,
    closeTab,
    cancelCloseConfirm,
    confirmCloseTab,
    deleteWorldTabsForCharacter,
    deleteWorldTabsForWorld,
    resetPersistentView,
    setTranscriptScrollbackChunks,
    load,
    dispose,
  };
}
