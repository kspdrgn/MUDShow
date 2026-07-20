<script lang="ts">
import { onMount, tick } from 'svelte';
import { loadAppSettings, saveAppSettings, type AppSettings } from './lib/app-settings';
import {
  getDefaultLogFolder,
  moveAppStorageFile,
  moveDefaultLogFolder,
  pickAppStorageFile,
  revealAppStorageFile,
  revealDefaultLogFolder,
  setAppStoragePath,
  loadAppStyleOverrides,
  saveAppStyleOverrides,
} from './lib/storage';
import WorldsAndCharactersEditor from './lib/components/settings/WorldsAndCharactersEditor.svelte';
import CharacterModal from './lib/components/settings/CharacterModal.svelte';
import ConfirmCloseTabModal from './lib/components/window/ConfirmCloseTabModal.svelte';
import HomePanel from './lib/components/window/HomePanel.svelte';
import LoggingModal from './lib/components/play/LoggingModal.svelte';
import NoticeModal from './lib/components/window/NoticeModal.svelte';
import PlayScreen from './lib/components/play/PlayScreen.svelte';
import SettingsPage from './lib/components/settings/SettingsPage.svelte';
import TriggersPane from './lib/components/settings/TriggersPane.svelte';
import TopBar from './lib/components/window/TopBar.svelte';
import WindowResizeHandles from './lib/components/window/WindowResizeHandles.svelte';
import WorldModal from './lib/components/settings/WorldModal.svelte';
import { session } from './lib/session';
import { generateLogFilename, getLogFileName } from './lib/logging';
import type { AppTab } from './lib/tabs';
import type { WorldTabSessionState } from './lib/world-session';
import {
  createAppStyleEditor,
  createDefaultAppStyleEditor,
  resolveAppStyleEditor,
  serializeAppStyleEditor,
  type AppStyleEditor,
  type AppStyleValues,
} from './lib/components/styles/style-settings';

  let appSettings = loadAppSettings();
  let appStyle: AppStyleEditor = createDefaultAppStyleEditor();
  let resolvedAppStyle: AppStyleValues = resolveAppStyleEditor(appStyle);
  let storageFilePath: string | null = appSettings.storageFilePath;
  let loggingModalTabId: string | null = null;
  let activeTab: AppTab | null = null;
  let activeWorldSession: WorldTabSessionState | null = null;
  let loggingModalSession: WorldTabSessionState | null = null;
  let loggingModalTab: AppTab | null = null;
  let loggingModalInitialFileName = '';
  let loggingModalRefreshNonce = 0;
  let resolvedLogFolderPath: string | null = null;
  let storageImportNoticeOpen = false;

  async function initializeStoragePath(): Promise<void> {
    try {
      const requestedPath = appSettings.storageFilePath;
      const resolvedPath = await setAppStoragePath(requestedPath);
      storageFilePath = resolvedPath;

      if (requestedPath !== null && requestedPath !== resolvedPath) {
        appSettings = { ...appSettings, storageFilePath: null };
        saveAppSettings(appSettings);
      }
    } catch {
      storageFilePath = appSettings.storageFilePath;
    }
  }

  async function initializeStyleSettings(): Promise<void> {
    try {
      appStyle = createAppStyleEditor(await loadAppStyleOverrides());
      resolvedAppStyle = resolveAppStyleEditor(appStyle);
    } catch (error) {
      console.error('failed to load app style overrides:', error);
      appStyle = createDefaultAppStyleEditor();
      resolvedAppStyle = resolveAppStyleEditor(appStyle);
    }
  }

  function updateAppSettings(patch: Partial<AppSettings>): void {
    appSettings = { ...appSettings, ...patch };
    saveAppSettings(appSettings);
  }

  function updateAppStyle(nextStyle: AppStyleEditor): void {
    appStyle = nextStyle;
    resolvedAppStyle = resolveAppStyleEditor(appStyle);
    void saveAppStyleOverrides(serializeAppStyleEditor(appStyle));
  }

  async function refreshResolvedLogFolder(): Promise<void> {
    try {
      console.debug('[logging] resolving default log folder');
      resolvedLogFolderPath = appSettings.defaultLogFolder ?? (await getDefaultLogFolder());
      console.debug('[logging] default log folder resolved', resolvedLogFolderPath);
    } catch (error) {
      console.error('[logging] default log folder lookup failed', error);
      console.debug('[logging] falling back to saved log folder', appSettings.defaultLogFolder);
      resolvedLogFolderPath = appSettings.defaultLogFolder ?? null;
    }
  }

  function openLoggingModal(tabId: string): void {
    loggingModalTabId = tabId;
  }

  function closeLoggingModal(): void {
    loggingModalTabId = null;
  }

  function refreshLoggingModalStatus(): void {
    loggingModalRefreshNonce += 1;
  }

  async function handleRevealStorageLocation(): Promise<void> {
    try {
      await revealAppStorageFile();
    } catch (error) {
      console.error('failed to reveal the storage location:', error);
    }
  }

  async function handleMoveStorageLocation(): Promise<void> {
    try {
      const nextPath = await moveAppStorageFile();
      if (!nextPath) {
        return;
      }

      appSettings = { ...appSettings, storageFilePath: nextPath };
      saveAppSettings(appSettings);
      storageFilePath = nextPath;
    } catch (error) {
      console.error('failed to move the storage location:', error);
    }
  }

  async function handlePickStorageLocation(): Promise<void> {
    if ($session.tabs.some((tab) => tab.kind === 'world')) {
      storageImportNoticeOpen = true;
      return;
    }

    try {
      const nextPath = await pickAppStorageFile();
      if (!nextPath) {
        return;
      }

      const resolvedPath = await setAppStoragePath(nextPath);
      appSettings = { ...appSettings, storageFilePath: resolvedPath };
      saveAppSettings(appSettings);
      storageFilePath = resolvedPath;
      await session.load();
    } catch (error) {
      console.error('failed to pick the storage location:', error);
    }
  }

  function closeStorageImportNotice(): void {
    storageImportNoticeOpen = false;
  }

  function isModalOpen(): boolean {
    return (
      $session.modalOpen ||
      ($session.closeConfirmTabId !== null && $session.closeConfirmMode === 'modal') ||
      loggingModalTabId !== null ||
      storageImportNoticeOpen
    );
  }

  async function handleMoveLogFolder(): Promise<void> {
    try {
      const nextFolder = await moveDefaultLogFolder(resolvedLogFolderPath ?? appSettings.defaultLogFolder ?? (await getDefaultLogFolder()));
      if (!nextFolder) {
        return;
      }

      appSettings = { ...appSettings, defaultLogFolder: nextFolder };
      saveAppSettings(appSettings);
      resolvedLogFolderPath = nextFolder;
    } catch (error) {
      console.error('failed to move the log folder:', error);
    }
  }

  async function handleRevealLogFolder(): Promise<void> {
    try {
      const folder = resolvedLogFolderPath ?? (await getDefaultLogFolder());
      console.debug('[logging] revealing default log folder', folder);
      await revealDefaultLogFolder(folder);
    } catch (error) {
      console.error('[logging] failed to reveal the log folder', error);
    }
  }

  $: activeTab = $session.tabs.find((tab) => tab.id === $session.activeTabId) ?? null;
  $: activeWorldSession =
    activeTab?.kind === 'world' ? $session.worldSessions[activeTab.id] ?? null : null;
  $: loggingModalTab = loggingModalTabId ? $session.tabs.find((tab) => tab.id === loggingModalTabId) ?? null : null;
  $: loggingModalSession =
    loggingModalTab?.kind === 'world' ? $session.worldSessions[loggingModalTab.id] ?? null : null;
  $: loggingModalInitialFileName =
    loggingModalSession?.loggingActive && loggingModalSession.logFilePath
      ? getLogFileName(loggingModalSession.logFilePath)
      : loggingModalSession?.currentWorld && loggingModalSession.currentCharacter
        ? generateLogFilename(loggingModalSession.currentWorld.name, loggingModalSession.currentCharacter.name)
        : '';

  $: pageTitle =
    activeTab?.kind === 'settings'
      ? `App Settings · MUDShow`
      : activeTab?.kind === 'triggers'
        ? 'Triggers · MUDShow'
      : activeTab?.kind === 'world' && activeWorldSession?.currentCharacter
        ? appSettings.titleAttention && activeWorldSession.hasNewActivity
          ? `* ${activeWorldSession.currentWorld?.name ?? activeWorldSession.currentCharacter.name} · ${activeWorldSession.currentCharacter.name}`
          : `${activeWorldSession.currentWorld?.name ?? activeWorldSession.currentCharacter.name} · ${activeWorldSession.currentCharacter.name}`
        : 'MUDShow';

  onMount(() => {
    const handleVisibilityChange = () => session.handleVisibilityChange();
    const handleKeyDown = (event: KeyboardEvent) => {
      const isReloadKey =
        event.key === 'F5' ||
        ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'r');

      if (isReloadKey) {
        event.preventDefault();
        event.stopPropagation();
        return;
      }

      if (event.ctrlKey && event.key === 'Tab' && !isModalOpen()) {
        event.preventDefault();
        if (event.shiftKey) {
          void session.selectPreviousTab();
        } else {
          void session.selectNextTab();
        }
        return;
      }

      session.handleGlobalKeyDown(event);
    };
    const startupOverlay = document.getElementById('startup-overlay');
    let disposed = false;

    void (async () => {
      try {
        await initializeStoragePath();
        await initializeStyleSettings();
        await refreshResolvedLogFolder();
        if (disposed) {
          return;
        }

        await session.load();
        await tick();
      } finally {
        if (!disposed) {
          startupOverlay?.remove();
        }
      }
    })();

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('keydown', handleKeyDown, { capture: true });

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown, { capture: true });
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
    onReorderTab={(tabId, targetIndex) => session.reorderTab(tabId, targetIndex)}
    onCloseTab={(tabId, source) => session.closeTab(tabId, source)}
    onCancelCloseConfirm={() => session.cancelCloseConfirm()}
    onConfirmCloseTab={() => session.confirmCloseTab()}
    onReconnectTab={(tabId) => void session.reconnectWorldTab(tabId)}
    onDisconnectTab={(tabId) => void session.disconnectWorldTab(tabId)}
    onQuickLogTab={(tabId) => void session.startLogging(tabId, resolvedLogFolderPath ?? appSettings.defaultLogFolder ?? null, null)}
    onOpenLoggingTab={(tabId) => openLoggingModal(tabId)}
    onStopLoggingTab={(tabId) => void session.stopLogging(tabId)}
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
    onEditWorldTab={(tabId) => void session.openWorldEditorFromWorldTab(tabId)}
    onEditCharacterTab={(tabId) => void session.openCharacterEditorFromWorldTab(tabId)}
    onOpenNotesTab={(tabId) => {
      session.activateWorldTab(tabId);
      void session.togglePanel('notes');
    }}
    onOpenTriggersTab={(worldId, characterId) => session.openTriggersTab(worldId, characterId)}
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
        onOpenSettings={() => session.selectTab('settings')}
      />
    {/if}

    {#each $session.tabs.filter((tab) => tab.kind === 'world') as tab (tab.id)}
      {@const worldSession = $session.worldSessions[tab.id] ?? session.getWorldSession(tab.id)}
      <PlayScreen
        scope={tab.id}
        visible={tab.id === $session.activeTabId}
        styleValues={resolvedAppStyle}
        activeBar={worldSession.activeBar}
        connectionStatus={worldSession.connectionStatus}
        bars={worldSession.inputBars}
        triggers={$session.triggers}
        notes={worldSession.notes}
        notesVisible={worldSession.notesVisible}
        linkImagePreviews={appSettings.linkImagePreviews}
        showCurrentOutputWhenScrollingUp={appSettings.showCurrentOutputWhenScrollingUp}
        userScrolled={worldSession.userScrolled}
        outputChunks={worldSession.outputChunks}
        characterWidth={worldSession.currentCharacter?.width}
        loggingActive={worldSession.loggingActive}
        imagePreviewCacheVersion={appSettings.imagePreviewCacheVersion}
        canReconnect={worldSession.connectionStatus === 'disconnected' && worldSession.currentCharacter !== null}
        canDisconnect={worldSession.connectionStatus === 'connecting' || worldSession.connectionStatus === 'connected'}
        canQuickLog={!worldSession.loggingActive}
        canStopLogging={worldSession.loggingActive}
        canEditWorld={worldSession.currentWorld !== null}
        canEditCharacter={worldSession.currentCharacter !== null && !worldSession.currentCharacter.isDefault}
        onReconnectTab={() => void session.reconnectWorldTab(tab.id)}
        onDisconnectTab={() => void session.disconnectWorldTab(tab.id)}
        onQuickLogTab={() => void session.startLogging(tab.id, resolvedLogFolderPath ?? appSettings.defaultLogFolder ?? null, null)}
        onOpenLoggingTab={() => openLoggingModal(tab.id)}
        onStopLoggingTab={() => void session.stopLogging(tab.id)}
        onEditWorldTab={() => void session.openWorldEditorFromWorldTab(tab.id)}
        onEditCharacterTab={() => void session.openCharacterEditorFromWorldTab(tab.id)}
        onCloseTab={() => session.closeTab(tab.id, 'shortcut')}
        onInputFocusBar={(bar) => session.handleInputFocus(bar)}
        onInputSubmit={(bar, value) => session.handleInputSubmit(bar, value)}
        onInputComplete={(bar, value, selectionStart) => session.completeInput(value, selectionStart)}
        onInputAddBar={(bar) => void session.addInputBarAfter(bar)}
        onInputRemoveBar={(bar) => void session.removeInputBar(bar)}
        onInputResizeBar={(bar, delta) => session.resizeInputBar(bar, delta)}
        onNotesInput={(notes) => session.saveNotes(notes)}
        onNotesClose={() => void session.togglePanel('notes')}
        onOutputScroll={() => session.handleOutputScroll()}
        onOutputScrollKey={(action) => session.handleOutputScrollKey(action)}
        onScrollToBottom={() => session.handleScrollToBottom()}
        onOpenTriggers={() => session.openTriggersTab(worldSession.currentWorld?.id ?? null, worldSession.currentCharacter?.id ?? null)}
      />
    {/each}

    {#if activeTab?.kind === 'triggers'}
      <TriggersPane
        worlds={$session.worlds}
        characters={$session.characters}
        triggers={$session.triggers}
        contextWorldId={$session.triggersContextWorldId}
        contextCharacterId={$session.triggersContextCharacterId}
        onHighlightSave={(index, draft) => session.saveHighlightDraft(index, draft)}
        onHighlightDelete={(index) => session.deleteHighlight(index)}
        onRuleSave={(index, draft) => session.saveRuleDraft(index, draft)}
        onRuleDelete={(index) => session.deleteRule(index)}
      />
    {/if}

    {#if activeTab?.kind === 'settings'}
      <SettingsPage
        settings={appSettings}
        onChange={updateAppSettings}
        style={appStyle}
        onStyleChange={updateAppStyle}
        activeTab={$session.settingsActiveTab}
        onTabChange={(tab) => session.setSettingsActiveTab(tab)}
        storageFilePath={storageFilePath}
        resolvedLogFolderPath={resolvedLogFolderPath}
        onRevealLogFolder={() => void handleRevealLogFolder()}
        onMoveLogFolder={() => void handleMoveLogFolder()}
        onRevealStorageLocation={() => void handleRevealStorageLocation()}
        onPickStorageLocation={() => void handlePickStorageLocation()}
        onMoveStorageLocation={() => void handleMoveStorageLocation()}
      />
    {/if}
  </main>
</div>

<WindowResizeHandles />

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

<NoticeModal
  open={storageImportNoticeOpen}
  title="import blocked"
  message="Import settings file requires closing all world tabs and starting over, please close all tabs and try again."
  confirmLabel="ok"
  onClose={closeStorageImportNotice}
/>

<LoggingModal
  open={loggingModalTab !== null && loggingModalSession !== null}
  active={loggingModalSession?.loggingActive === true}
  tabTitle={loggingModalTab?.title ?? ''}
  currentPath={loggingModalSession?.logFilePath ?? ''}
  defaultFolder={resolvedLogFolderPath ?? appSettings.defaultLogFolder ?? ''}
  initialFileName={loggingModalInitialFileName}
  logError={loggingModalSession?.logError ?? ''}
  refreshNonce={loggingModalRefreshNonce}
  onCancel={closeLoggingModal}
  onStartLogging={async (fileName) => {
    if (!loggingModalTabId) {
      return;
    }

    await session.startLogging(loggingModalTabId, resolvedLogFolderPath ?? appSettings.defaultLogFolder ?? null, fileName);
    refreshLoggingModalStatus();
    closeLoggingModal();
  }}
  onStopLogging={() => {
    if (!loggingModalTabId) {
      return;
    }

    void session.stopLogging(loggingModalTabId);
    closeLoggingModal();
  }}
  onRenameLogging={async (fileName) => {
    if (!loggingModalTabId) {
      return;
    }

    await session.renameLogging(loggingModalTabId, fileName);
    refreshLoggingModalStatus();
    closeLoggingModal();
  }}
  onRevealLog={() => {
    if (!loggingModalTabId) {
      return;
    }

    const loggingSession = loggingModalSession;
    if (loggingSession?.logFilePath) {
      void session.revealLoggingFile(loggingModalTabId);
      return;
    }

    void revealDefaultLogFolder(resolvedLogFolderPath ?? appSettings.defaultLogFolder ?? null);
  }}
  onOpenLoggingSettings={() => {
    closeLoggingModal();
    session.selectTab('settings');
    session.setSettingsActiveTab('logging');
  }}
/>
