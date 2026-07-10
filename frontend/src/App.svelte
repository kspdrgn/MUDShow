<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAppSettings, saveAppSettings, type AppSettings } from './lib/app-settings';
  import { getAppStoragePath } from './lib/storage';
  import WorldsAndCharactersEditor from './lib/components/WorldsAndCharactersEditor.svelte';
  import CharacterModal from './lib/components/CharacterModal.svelte';
  import ConfirmCloseTabModal from './lib/components/ConfirmCloseTabModal.svelte';
  import HomePanel from './lib/components/HomePanel.svelte';
  import PlayScreen from './lib/components/PlayScreen.svelte';
  import SettingsPage from './lib/components/SettingsPage.svelte';
  import TopBar from './lib/components/TopBar.svelte';
  import WorldModal from './lib/components/WorldModal.svelte';
  import { session } from './lib/session';
  import { isTauriAvailable } from './lib/tauri';
  import type { AppTab } from './lib/tabs';
  import type { WorldTabSessionState } from './lib/world-session';

  let appSettings = loadAppSettings();
  let storageFilePath: string | null = null;
  let activeTab: AppTab | null = null;
  let activeWorldSession: WorldTabSessionState | null = null;

  async function refreshStorageFilePath(): Promise<void> {
    if (!isTauriAvailable()) {
      storageFilePath = null;
      return;
    }

    try {
      storageFilePath = await getAppStoragePath();
    } catch {
      storageFilePath = null;
    }
  }

  function updateAppSettings(patch: Partial<AppSettings>): void {
    appSettings = { ...appSettings, ...patch };
    saveAppSettings(appSettings);
    void refreshStorageFilePath();
  }

  $: activeTab = $session.tabs.find((tab) => tab.id === $session.activeTabId) ?? null;
  $: activeWorldSession =
    activeTab?.kind === 'world' ? $session.worldSessions[activeTab.id] ?? null : null;

  $: pageTitle =
    activeTab?.kind === 'settings'
      ? `App Settings · MUDShow`
      : activeTab?.kind === 'world' && activeWorldSession?.currentCharacter
        ? appSettings.titleAttention && activeWorldSession.hasNewActivity
          ? `* ${activeWorldSession.currentWorld?.name ?? activeWorldSession.currentCharacter.name} · ${activeWorldSession.currentCharacter.name}`
          : `${activeWorldSession.currentWorld?.name ?? activeWorldSession.currentCharacter.name} · ${activeWorldSession.currentCharacter.name}`
        : 'MUDShow';

  onMount(() => {
    void session.load();
    void refreshStorageFilePath();

    const handleVisibilityChange = () => session.handleVisibilityChange();
    const handleKeyDown = (event: KeyboardEvent) => session.handleGlobalKeyDown(event);

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
      session.dispose();
    };
  });
</script>

<svelte:head>
  <title>{pageTitle}</title>
</svelte:head>

<div id="app-shell">
  <TopBar
    tabs={$session.tabs}
    activeTabId={$session.activeTabId}
    worldSessions={$session.worldSessions}
    closeConfirmTabId={$session.closeConfirmTabId}
    closeConfirmMode={$session.closeConfirmMode}
    worlds={$session.worlds}
    characters={$session.characters}
    onSelectTab={(tabId) => session.selectTab(tabId)}
    onCloseTab={(tabId, source) => session.closeTab(tabId, source)}
    onCancelCloseConfirm={() => session.cancelCloseConfirm()}
    onConfirmCloseTab={() => session.confirmCloseTab()}
    onReconnectTab={(tabId) => void session.reconnectWorldTab(tabId)}
    onDisconnectTab={(tabId) => void session.disconnectWorldTab(tabId)}
    onConnectWorld={(worldId) => {
      const defaultCharacterIndex = $session.characters.findIndex(
        (character) => character.worldId === worldId && character.isDefault,
      );
      const fallbackCharacterIndex =
        defaultCharacterIndex >= 0
          ? defaultCharacterIndex
          : $session.characters.findIndex((character) => character.worldId === worldId);
      if (fallbackCharacterIndex >= 0) {
        void session.connectToCharacter(fallbackCharacterIndex);
      }
    }}
    onConnectCharacter={(index) => void session.connectToCharacter(index)}
    onOpenCharactersTab={() => session.selectTab('characters')}
  />

  <main id="app-main">
    {#if activeTab === null}
      <HomePanel
        worlds={$session.worlds}
        characters={$session.characters}
        onConnectWorld={(worldId) => {
          const defaultCharacterIndex = $session.characters.findIndex(
            (character) => character.worldId === worldId && character.isDefault,
          );
          const fallbackCharacterIndex =
            defaultCharacterIndex >= 0
              ? defaultCharacterIndex
              : $session.characters.findIndex((character) => character.worldId === worldId);
          if (fallbackCharacterIndex >= 0) {
            void session.connectToCharacter(fallbackCharacterIndex);
          }
        }}
        onConnectCharacter={(index) => void session.connectToCharacter(index)}
        onOpenCharactersTab={() => session.selectTab('characters')}
        onOpenSettings={() => session.selectTab('settings')}
      />
    {:else if activeTab.kind === 'characters'}
      <WorldsAndCharactersEditor
        worlds={$session.worlds}
        characters={$session.characters}
        onOpenWorld={(index) => void session.openWorldModal(index)}
        onEditWorld={(index) => void session.openWorldModal(index)}
        onDeleteWorld={(index) => void session.deleteWorld(index)}
        onOpenCharacter={(worldId, index) => void session.openCharacterModal(worldId, index)}
        onEditCharacter={(index) => {
          const character = $session.characters[index];
          if (character) {
            void session.openCharacterModal(character.worldId, index);
          }
        }}
        onDeleteCharacter={(index) => session.deleteCharacter(index)}
        onConnectCharacter={(index) => void session.connectToCharacter(index)}
      />
    {/if}

    {#each $session.tabs.filter((tab) => tab.kind === 'world') as tab (tab.id)}
      {@const worldSession = $session.worldSessions[tab.id] ?? session.getWorldSession(tab.id)}
      <PlayScreen
        scope={tab.id}
        visible={tab.id === $session.activeTabId}
        activeBar={worldSession.activeBar}
        connectionStatus={worldSession.connectionStatus}
        bars={worldSession.inputBars}
        highlights={$session.highlights}
        highlightsVisible={worldSession.highlightsVisible}
        notes={worldSession.notes}
        notesVisible={worldSession.notesVisible}
        outputChunks={worldSession.outputChunks}
        outputRevision={worldSession.outputRevision}
        playWidth={worldSession.currentCharacter?.width !== undefined ? `${worldSession.currentCharacter.width}ch` : 'none'}
        onHighlightAdd={(pattern, color) => session.addHighlight(pattern, color)}
        onHighlightDelete={(index) => session.deleteHighlight(index)}
        onInputFocusBar={(bar) => session.handleInputFocus(bar)}
        onInputSubmit={(bar, value) => session.handleInputSubmit(bar, value)}
        onInputComplete={(bar, value, selectionStart) => session.completeInput(value, selectionStart)}
        onInputAddBar={(bar) => void session.addInputBarAfter(bar)}
        onInputRemoveBar={(bar) => void session.removeInputBar(bar)}
        onInputResizeBar={(bar, delta) => session.resizeInputBar(bar, delta)}
        onNotesInput={(notes) => session.saveNotes(notes)}
        onOutputScroll={() => session.handleOutputScroll()}
      />
    {/each}

    {#if activeTab?.kind === 'settings'}
      <SettingsPage
        settings={appSettings}
        onChange={updateAppSettings}
        storageFilePath={storageFilePath}
      />
    {/if}
  </main>
</div>

<CharacterModal
  open={$session.modalOpen && $session.modalKind === 'character'}
  title={$session.modalTitle}
  worldName={
    $session.modalKind === 'character' && $session.characterWorldId
      ? $session.worlds.find((world) => world.id === $session.characterWorldId)?.name ?? ''
      : ''
  }
  draft={$session.modalDraft}
  onCancel={() => session.closeModal()}
  onSave={(draft) => session.saveCharacter(draft)}
/>

<WorldModal
  open={$session.modalOpen && $session.modalKind === 'world'}
  title={$session.modalTitle}
  draft={$session.worldModalDraft}
  onCancel={() => session.closeModal()}
  onSave={(draft) => session.saveWorld(draft)}
/>

<ConfirmCloseTabModal
  open={$session.closeConfirmMode === 'modal' && $session.closeConfirmTabId !== null}
  worldName={
    $session.closeConfirmTabId
      ? $session.worldSessions[$session.closeConfirmTabId]?.currentWorld?.name ??
        $session.worldSessions[$session.closeConfirmTabId]?.currentCharacter?.name ??
        $session.tabs.find((tab) => tab.id === $session.closeConfirmTabId)?.title ??
        'this world'
      : ''
  }
  onCancel={() => session.cancelCloseConfirm()}
  onConfirm={() => session.confirmCloseTab()}
/>
