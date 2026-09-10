import { get, writable } from 'svelte/store';
import { buildHighlightRegexes } from './formatting';
import { DEFAULT_TRANSCRIPT_SCROLLBACK_CHUNKS } from './playback';
import { createSessionTabsActions } from './session-tabs';
import { createCharacterActions } from './session-edit-world-character';
import { createInitialState, type SessionState } from './session-state';
import { createAppShortcutActions } from './session-app-shortcuts';
import { createWorldConnectionActions } from './session-world-connection';
import { createWorldCaptureActions } from './session-world-capture';
import { createWorldInputActions } from './session-world-input';
import { createWorldChannelActions } from './session-channels';
import { createWorldShortcutActions } from './session-world-shortcuts';
import { createTriggerActions } from './session-triggers';
import { createWorldTranscriptActions } from './session-world-transcript';
import { focusElement, nextFrame, scrollElementToBottom } from './session-dom';
import { appServices } from './app-services';
import type { CharacterRecord, HighlightRule, Trigger, WorldRecord } from './types';
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
  type SettingsTabId,
} from './tabs';
import {
  applyWorldProjection,
  createWorldTabSessionState,
  type WorldTabSessionState,
} from './world-session';
import {
  createWorldSessionContainerRegistry,
  createWorldSessionKey,
} from './world-session-container';
import type { WorldSessionKey } from './world-session-registry';
import { getWorldDomScope, getWorldInputBarInputId, getWorldOutputAreaId } from './world-dom';
import { createWorldPluginRegistryForSession } from './world-plugins.js';
import type { WorldPluginSession } from './world-plugin-registry.js';
import type { WorldSessionAction } from './world-session-action.js';
import type { WorldPluginServiceKey, WorldPluginSurfaceContribution } from './world-plugin.js';

interface ModalWindowHandlers {
  onOpen: (kind: 'world' | 'character', title: string) => void;
  onClose: (kind: 'world' | 'character') => void;
}

function createSession() {
  const state = writable<SessionState>(createInitialState());
  const getHighlightTriggers = (triggers: Trigger[]): HighlightRule[] =>
    triggers.filter((trigger): trigger is HighlightRule => trigger.type === 'highlight');
  let highlightRegexes = buildHighlightRegexes(getHighlightTriggers(get(state).triggers));
  let nextWorldTabId = 1;
  let nextConnectionId = 1;
  let transcriptScrollbackChunks = DEFAULT_TRANSCRIPT_SCROLLBACK_CHUNKS;
  const worldSessionContainers = createWorldSessionContainerRegistry();
  const worldPluginRegistry = createWorldPluginRegistryForSession(worldSessionContainers);
  let worldPluginActionHandler: (tabId: string, pluginId: string, actionId: string) => void = () => {};
  let worldPluginSurfaceHandler: (tabId: string, pluginId: string, surfaceId: string, payload?: Readonly<Record<string, unknown>>) => void = () => {};
  let clearLoggingQueue = (_tabId: string): void => {};
  let modalWindowHandlers: ModalWindowHandlers = {
    onOpen: () => {},
    onClose: () => {},
  };
  let closeModal = (): void => {};

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
    return getWorldSessions()[tabId] ?? createWorldTabSessionState(transcriptScrollbackChunks);
  }

  function getWorldPluginSession(
    tabId: string,
    world: WorldRecord,
    character: CharacterRecord | null,
  ): WorldPluginSession | null {
    const tab = getTab(tabId);
    if (!tab || tab.kind !== 'world') {
      return null;
    }

    const key = createWorldSessionKey(world.id, character?.id ?? null);
    const container = worldSessionContainers.container.ensure(key);
    if (container.pluginSession) {
      return container.pluginSession;
    }

    const connection = worldSessionContainers.connection.get(key);
    if (!connection) {
      return null;
    }

    container.pluginSession = worldPluginRegistry.createSession({
      world,
      character,
      sessionKey: key,
      connection: {
        send: (command) => connection.send(command),
      },
      services: {
        get: <T>(key: WorldPluginServiceKey<T>) => container.pluginSessionServices?.get<T>(key) ?? null,
        set: <T>(key: WorldPluginServiceKey<T>, service: T) => container.pluginSessionServices?.set(key, service),
      },
      host: {
        invokeAction: (pluginId, actionId) => worldPluginActionHandler(tabId, pluginId, actionId),
        openSurface: (pluginId, surfaceId, payload) => worldPluginSurfaceHandler(tabId, pluginId, surfaceId, payload),
      },
    });
    container.pluginSession.subscribe(() => patch({}));
    return container.pluginSession;
  }

  function getWorldPluginActions(tabId: string): WorldSessionAction[] {
    return getWorldSession(tabId).currentWorld
      ? getWorldPluginSession(
        tabId,
        getWorldSession(tabId).currentWorld as WorldRecord,
        getWorldSession(tabId).currentCharacter,
      )?.getActions() ?? []
      : [];
  }

  function getWorldPluginSurfaces(tabId: string): WorldPluginSurfaceContribution[] {
    const worldSession = getWorldSession(tabId);
    return worldSession.currentWorld
      ? getWorldPluginSession(tabId, worldSession.currentWorld, worldSession.currentCharacter)?.getSurfaces() ?? []
      : [];
  }

  function getWorldPluginService<T>(tabId: string, serviceKey: WorldPluginServiceKey<T>): T | null {
    const worldSession = getWorldSession(tabId);
    if (!worldSession.currentWorld) {
      return null;
    }
    const sessionKey = createWorldSessionKey(worldSession.currentWorld.id, worldSession.currentCharacter?.id ?? null);
    return worldSessionContainers.container.get(sessionKey)?.pluginSessionServices.get<T>(serviceKey) ?? null;
  }

  function setWorldPluginActionHandler(
    handler: (tabId: string, pluginId: string, actionId: string) => void,
  ): void {
    worldPluginActionHandler = handler;
  }

  function setWorldPluginSurfaceHandler(
    handler: (tabId: string, pluginId: string, surfaceId: string, payload?: Readonly<Record<string, unknown>>) => void,
  ): void {
    worldPluginSurfaceHandler = handler;
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

  function getWorldSessionKeyForTab(tabId: string): WorldSessionKey | null {
    const tab = getTab(tabId);
    if (!tab || tab.kind !== 'world') {
      return null;
    }

    return createWorldSessionKey(tab.worldId, tab.characterId);
  }

  function getActiveWorldSessionKey(): WorldSessionKey | null {
    const tabId = tabsActions.getActiveWorldTabId();
    return tabId ? getWorldSessionKeyForTab(tabId) : null;
  }

  function resetPersistentView(): void {
    const current = getState();
    const nextTabs = current.tabs.filter((tab) => tab.kind !== 'world');
    const activeTabStillExists = current.activeTabId !== null && nextTabs.some((tab) => tab.id === current.activeTabId);

    for (const tab of current.tabs) {
      if (tab.kind === 'world') {
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
    highlightRegexes = buildHighlightRegexes([]);
    nextWorldTabId = 1;
    nextConnectionId = 1;
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

  function setSettingsActiveTab(tab: SettingsTabId): void {
    patch({ settingsActiveTab: tab });
  }

  function setTranscriptDiagnosticsEnabled(enabled: boolean): void {
    patch({ transcriptDiagnosticsEnabled: enabled });
  }

  function toggleTranscriptDiagnosticsEnabled(): void {
    patch({ transcriptDiagnosticsEnabled: !getState().transcriptDiagnosticsEnabled });
  }

  function setConfirmUnloggedTabClose(confirmUnloggedTabClose: boolean): void {
    patch({ confirmUnloggedTabClose });
  }

  const tabsActions = createSessionTabsActions({
    state,
    getState,
    patch,
    setHighlightRegexes: (regexes) => {
      highlightRegexes = regexes;
    },
    clearLoggingQueue,
    worldSessionContainers,
  });

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
      // A world tab may have received output while it was inactive. Its DOM
      // remains mounted, so the normal append path intentionally skips the
      // inactive tab; restore the live view after activation has rendered.
      void nextFrame().then(() => {
        if (getActiveWorldTabId() !== tabId) {
          return;
        }

        const session = getWorldSession(tabId);
        if (!session.userScrolled) {
          scrollElementToBottom(getWorldOutputAreaId(getWorldDomScope(tabId)));
        }
      });
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

  function ensureWorldTab(world: WorldRecord, character: CharacterRecord | null = null): string {
    const current = getState();
    const existing = current.tabs.find(
      (tab): tab is WorldTab =>
        tab.kind === 'world' &&
        tab.worldId === world.id &&
        tab.characterId === (character?.id ?? null),
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
      character?.id ?? null,
      character ? `${world.name} · ${character.name}` : world.name,
      connectionId,
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

  const load = async () => {
    await tabsActions.load();
  };

  function setTranscriptScrollbackChunks(maxChunks: number): void {
    tabsActions.setTranscriptScrollbackChunks(maxChunks);
  }

  const transcriptActions = createWorldTranscriptActions({
    getState,
    patch,
    getActiveWorldTabId: tabsActions.getActiveWorldTabId,
    getActiveWorldScope: () => {
      const tabId = tabsActions.getActiveWorldTabId();
      return tabId ? getWorldDomScope(tabId) : null;
    },
    getWorldSession: tabsActions.getWorldSession,
    getWorldSessionKeyForTab,
    updateWorldSession: tabsActions.updateWorldSession,
    worldSessionContainers,
  });

  const captureActions = createWorldCaptureActions({
    getWorldSession: tabsActions.getWorldSession,
    getWorldPluginSession: (tabId) => {
      const worldSession = tabsActions.getWorldSession(tabId);
      return worldSession.currentWorld
        ? getWorldPluginSession(tabId, worldSession.currentWorld, worldSession.currentCharacter)
        : null;
    },
  });

  const characterActions = createCharacterActions({
    state,
    getState,
    patch,
    onRecordsChanged: tabsActions.refreshWorldTabs,
    onWorldDeleted: tabsActions.deleteWorldTabsForWorld,
    onCharacterDeleted: tabsActions.deleteWorldTabsForCharacter,
    onModalWindowOpen: (kind, title) => modalWindowHandlers.onOpen(kind, title),
    onModalWindowClose: (kind) => modalWindowHandlers.onClose(kind),
  });

  const triggerActions = createTriggerActions({
    getState,
    patch,
    setHighlightRegexes: (regexes) => {
      highlightRegexes = regexes;
    },
  });

  const connectionActions = createWorldConnectionActions({
    getState,
    getWorldSession: tabsActions.getWorldSession,
    ensureWorldSession: tabsActions.ensureWorldSession,
    updateWorldSession: tabsActions.updateWorldSession,
    activateWorldTab: tabsActions.activateWorldTab,
    worldSessionContainers,
    getWorldPluginSession,
    ensureWorldTab: tabsActions.ensureWorldTab,
    appendOutputToTab: transcriptActions.appendOutputToTab,
    appendIncomingRawMessageToTab: transcriptActions.appendIncomingRawMessageToTab,
    captureIncomingWorldLine: captureActions.captureIncomingWorldLine,
    appendConnectionStatusToTab: transcriptActions.appendConnectionStatusToTab,
    setHighlightRegexes: (regexes) => {
      highlightRegexes = regexes;
    },
    setWorldNotes: (tabId, notes) => {
      const key = getWorldSessionKeyForTab(tabId);
      if (key) {
        worldSessionContainers.notes.ensure(key).set(notes);
      }
    },
  });

  const inputActions = createWorldInputActions({
    getActiveWorldTabId: tabsActions.getActiveWorldTabId,
    getActiveWorldSessionKey: () => getActiveWorldSessionKey(),
    getWorldSessionKeyForTab,
    resolveActiveWorldScope: () => {
      const tabId = tabsActions.getActiveWorldTabId();
      return tabId ? getWorldDomScope(tabId) : null;
    },
    getWorldSession: tabsActions.getWorldSession,
    updateWorldSession: tabsActions.updateWorldSession,
    worldSessionContainers,
  });

  const channelActions = createWorldChannelActions({
    getActiveWorldTabId: tabsActions.getActiveWorldTabId,
    resolveActiveWorldScope: () => {
      const tabId = tabsActions.getActiveWorldTabId();
      return tabId ? getWorldDomScope(tabId) : null;
    },
    updateWorldSession: tabsActions.updateWorldSession,
  });

  const shortcutActions = createWorldShortcutActions({
    getActiveWorldTabId: tabsActions.getActiveWorldTabId,
    getWorldSession: tabsActions.getWorldSession,
    updateWorldSession: tabsActions.updateWorldSession,
    addInputBarAfter: inputActions.addInputBarAfter,
  });

  const appShortcutActions = createAppShortcutActions({
    getState,
    patch,
    getActiveWorldTabId: tabsActions.getActiveWorldTabId,
    closeTab: tabsActions.closeTab,
    closeModal: () => closeModal(),
    handleWorldShortcutKeyDown: shortcutActions.handleWorldShortcutKeyDown,
  });

  clearLoggingQueue = transcriptActions.clearLoggingQueue;
  closeModal = characterActions.closeModal;

  async function openWorldEditorFromWorldTab(tabId: string): Promise<void> {
    const session = tabsActions.getWorldSession(tabId);
    const world = session.currentWorld;
    if (!world) {
      return;
    }

    const worldIndex = getState().worlds.findIndex((entry) => entry.id === world.id);
    if (worldIndex < 0) {
      return;
    }

    tabsActions.selectTab(CHARACTERS_TAB_ID);
    await nextFrame();
    await characterActions.openWorldModal(worldIndex);
  }

  async function openCharacterEditorFromWorldTab(tabId: string): Promise<void> {
    const session = tabsActions.getWorldSession(tabId);
    const character = session.currentCharacter;
    if (!character) {
      return;
    }

    const characterIndex = getState().characters.findIndex((entry) => entry.id === character.id);
    if (characterIndex < 0) {
      return;
    }

    tabsActions.selectTab(CHARACTERS_TAB_ID);
    await nextFrame();
    await characterActions.openCharacterModal(character.worldId, characterIndex);
  }

  function setModalWindowHandlers(handlers: Partial<ModalWindowHandlers>): void {
    modalWindowHandlers = {
      ...modalWindowHandlers,
      ...handlers,
    };
  }

  return {
    subscribe: state.subscribe,
    load: tabsActions.load,
    dispose: tabsActions.dispose,
    selectTab: tabsActions.selectTab,
    activateWorldTab,
    setTranscriptScrollbackChunks: tabsActions.setTranscriptScrollbackChunks,
    setSettingsActiveTab,
    setTranscriptDiagnosticsEnabled,
    toggleTranscriptDiagnosticsEnabled,
    setConfirmUnloggedTabClose,
    openTriggersTab: tabsActions.openTriggersTab,
    selectNextTab: tabsActions.selectNextTab,
    selectPreviousTab: tabsActions.selectPreviousTab,
    reorderTab: tabsActions.reorderTab,
    closeTab: tabsActions.closeTab,
    cancelCloseConfirm: tabsActions.cancelCloseConfirm,
    confirmCloseTab: tabsActions.confirmCloseTab,
    ensureWorldTab: tabsActions.ensureWorldTab,
    getWorldSession: tabsActions.getWorldSession,
    refreshWorldTabs: tabsActions.refreshWorldTabs,
    deleteWorldTabsForCharacter: tabsActions.deleteWorldTabsForCharacter,
    deleteWorldTabsForWorld: tabsActions.deleteWorldTabsForWorld,
    worldSessionContainers,
    getWorldPluginActions,
    getWorldPluginSurfaces,
    getWorldPluginService,
    setWorldPluginActionHandler,
    setWorldPluginSurfaceHandler,
    openWorldEditorFromWorldTab,
    openCharacterEditorFromWorldTab,
    setModalWindowHandlers,
    ...connectionActions,
    ...inputActions,
    channels: channelActions,
    ...channelActions,
    ...shortcutActions,
    ...appShortcutActions,
    ...transcriptActions,
    ...characterActions,
    ...triggerActions,
  };
}

export const session = createSession();
