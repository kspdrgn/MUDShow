<script lang="ts">
  import { onMount } from 'svelte';
  import { loadAppSettings, saveAppSettings, type AppSettings } from './lib/app-settings';
  import WorldsAndCharactersEditor from './lib/components/WorldsAndCharactersEditor.svelte';
  import CharacterModal from './lib/components/CharacterModal.svelte';
  import HomePanel from './lib/components/HomePanel.svelte';
  import PlayScreen from './lib/components/PlayScreen.svelte';
  import SettingsPage from './lib/components/SettingsPage.svelte';
  import TopBar from './lib/components/TopBar.svelte';
  import WorldModal from './lib/components/WorldModal.svelte';
  import WorldSelectorModal from './lib/components/WorldSelectorModal.svelte';
  import { session } from './lib/session';
  import type { AppTab } from './lib/tabs';
  import type { WorldTabSessionState } from './lib/world-session';

  let appSettings = loadAppSettings();
  let activeTab: AppTab | null = null;
  let activeWorldSession: WorldTabSessionState | null = null;

  function updateAppSettings(patch: Partial<AppSettings>): void {
    appSettings = { ...appSettings, ...patch };
    saveAppSettings(appSettings);
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
    worlds={$session.worlds}
    characters={$session.characters}
    onSelectTab={(tabId) => session.selectTab(tabId)}
    onCloseTab={(tabId) => session.closeTab(tabId)}
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
        onOpenCharacters={() => session.selectTab('characters')}
        onOpenSettings={() => session.selectTab('settings')}
        onOpenWorldSelector={() => session.openWorldSelector()}
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
      />
    {/if}
  </main>
</div>

<WorldSelectorModal
  open={$session.worldSelectorOpen}
  worlds={$session.worlds}
  characters={$session.characters}
  onCancel={() => session.closeWorldSelector()}
  onConnectWorld={(worldId) => {
    const defaultCharacterIndex = $session.characters.findIndex(
      (character) => character.worldId === worldId && character.isDefault,
    );
    if (defaultCharacterIndex >= 0) {
      session.closeWorldSelector();
      void session.connectToCharacter(defaultCharacterIndex);
    }
  }}
  onConnectCharacter={(index) => {
    session.closeWorldSelector();
    void session.connectToCharacter(index);
  }}
  onAddWorld={() => {
    session.closeWorldSelector();
    void session.openWorldModal();
  }}
/>

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
