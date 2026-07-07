<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { isTauriAvailable, invoke } from '../tauri';
  import {
    CHARACTERS_TAB_ID,
    SETTINGS_TAB_ID,
    type AppTab,
  } from '../tabs';
  import type { CharacterRecord, WorldRecord } from '../types';
  import StatusDot from './StatusDot.svelte';
  import type { WorldTabSessionState } from '../world-session';
  import QuickConnectPanel from './QuickConnectPanel.svelte';

  export let tabs: AppTab[] = [];
  export let activeTabId: string | null = null;
  export let worldSessions: Record<string, WorldTabSessionState> = {};
  export let closeConfirmTabId: string | null = null;
  export let closeConfirmMode: 'modal' | 'dropdown' | null = null;
  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let onSelectTab: (tabId: string) => void;
  export let onCloseTab: (tabId: string, source?: 'mouse' | 'shortcut') => void;
  export let onCancelCloseConfirm: () => void;
  export let onConfirmCloseTab: () => void;
  export let onReconnectTab: (tabId: string) => void;
  export let onDisconnectTab: (tabId: string) => void;
  export let onConnectWorld: (worldId: string) => void;
  export let onConnectCharacter: (index: number) => void;
  export let onOpenCharactersTab: () => void;

  let menuOpen = false;
  let quickConnectOpen = false;
  let worldContextMenuOpen = false;
  let worldContextMenuTabId: string | null = null;
  let quickConnectSide: 'left' | 'right' = 'right';
  let menuContainer: HTMLDivElement | null = null;
  let quickConnectContainer: HTMLDivElement | null = null;
  let quickConnectButton: HTMLButtonElement | null = null;
  let quickConnectDropdown: HTMLDivElement | null = null;
  let worldContextMenuDropdown: HTMLDivElement | null = null;
  let worldContextMenuPosition = { x: 0, y: 0 };
  let worldContextMenuTab: AppTab | null = null;
  let worldContextMenuSession: WorldTabSessionState | null = null;
  let worldContextMenuCanReconnect = false;
  let worldContextMenuCanDisconnect = false;
  let closeConfirmDropdown: HTMLDivElement | null = null;
  let closeConfirmPosition = { x: 0, y: 0 };
  let closeConfirmAnchorRect: DOMRect | null = null;
  let closeConfirmTab: AppTab | null = null;
  let closeConfirmWorldName = '';
  const tabCloseButtons: Record<string, HTMLButtonElement | null> = {};

  $: worldContextMenuTab = worldContextMenuTabId
    ? tabs.find((tab) => tab.id === worldContextMenuTabId) ?? null
    : null;
  $: worldContextMenuSession =
    worldContextMenuTab?.kind === 'world'
      ? worldSessions[worldContextMenuTab.id] ?? null
      : null;
  $: worldContextMenuCanReconnect =
    worldContextMenuTab?.kind === 'world' &&
    worldContextMenuSession !== null &&
    worldContextMenuSession.connectionStatus === 'disconnected' &&
    worldContextMenuSession.disconnectReason !== 'manual' &&
    worldContextMenuSession.currentCharacter !== null;
  $: worldContextMenuCanDisconnect =
    worldContextMenuTab?.kind === 'world' &&
    worldContextMenuSession !== null &&
    (worldContextMenuSession.connectionStatus === 'connecting' ||
      worldContextMenuSession.connectionStatus === 'connected');
  $: closeConfirmTab = closeConfirmTabId ? tabs.find((tab) => tab.id === closeConfirmTabId) ?? null : null;
  $: closeConfirmWorldName = closeConfirmTabId
    ? worldSessions[closeConfirmTabId]?.currentWorld?.name ??
      worldSessions[closeConfirmTabId]?.currentCharacter?.name ??
      closeConfirmTab?.title ??
      'this world'
    : '';

  function isCloseConfirmDropdownOpen(): boolean {
    return closeConfirmMode === 'dropdown' && closeConfirmTab !== null;
  }

  function setCloseConfirmAnchor(target: EventTarget | null): void {
    if (!(target instanceof HTMLElement)) {
      closeConfirmAnchorRect = null;
      return;
    }

    closeConfirmAnchorRect = target.getBoundingClientRect();
    closeConfirmPosition = {
      x: closeConfirmAnchorRect.left,
      y: closeConfirmAnchorRect.bottom + 10,
    };
  }

  function toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    menuOpen = !menuOpen;
    if (menuOpen) {
      quickConnectOpen = false;
      closeWorldContextMenu();
    }
  }

  function toggleQuickConnect(event: MouseEvent): void {
    event.stopPropagation();
    quickConnectOpen = !quickConnectOpen;
    if (quickConnectOpen) {
      menuOpen = false;
      closeWorldContextMenu();
      void tick().then(updateQuickConnectSide);
    }
  }

  function closeMenu(): void {
    menuOpen = false;
  }

  function closeQuickConnect(): void {
    quickConnectOpen = false;
  }

  function closeWorldContextMenu(): void {
    worldContextMenuOpen = false;
    worldContextMenuTabId = null;
  }

  function updateCloseConfirmPosition(): void {
    if (!isCloseConfirmDropdownOpen()) {
      return;
    }

    if (!closeConfirmAnchorRect || !closeConfirmDropdown) {
      return;
    }

    const margin = 8;
    const dropdownRect = closeConfirmDropdown.getBoundingClientRect();
    const preferredLeft = closeConfirmAnchorRect.left - Math.max(0, dropdownRect.width - closeConfirmAnchorRect.width);
    const preferredTop = closeConfirmAnchorRect.bottom + 10;
    const maxLeft = window.innerWidth - dropdownRect.width - margin;
    const maxTop = window.innerHeight - dropdownRect.height - margin;
    const top = maxTop >= preferredTop ? preferredTop : Math.max(preferredTop, margin);

    closeConfirmPosition = {
      x: Math.max(margin, Math.min(preferredLeft, maxLeft)),
      y: top,
    };
  }

  $: if (isCloseConfirmDropdownOpen()) {
    void tick().then(updateCloseConfirmPosition);
  }

  function updateQuickConnectSide(): void {
    if (!quickConnectOpen || !quickConnectButton) {
      return;
    }

    const dropdownWidth = quickConnectDropdown?.offsetWidth ?? 420;
    const buttonRect = quickConnectButton.getBoundingClientRect();
    const availableRight = window.innerWidth - buttonRect.left;
    quickConnectSide = availableRight >= dropdownWidth + 12 ? 'right' : 'left';
  }

  function updateWorldContextMenuPosition(): void {
    if (!worldContextMenuOpen || !worldContextMenuDropdown) {
      return;
    }

    const margin = 8;
    const rect = worldContextMenuDropdown.getBoundingClientRect();
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;

    worldContextMenuPosition = {
      x: Math.max(margin, Math.min(worldContextMenuPosition.x, maxLeft)),
      y: Math.max(margin, Math.min(worldContextMenuPosition.y, maxTop)),
    };
  }

  async function openWorldContextMenu(event: MouseEvent, tab: AppTab): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    menuOpen = false;
    quickConnectOpen = false;
    worldContextMenuTabId = tab.id;
    worldContextMenuOpen = true;
    worldContextMenuPosition = {
      x: event.clientX,
      y: event.clientY,
    };

    await tick();
    updateWorldContextMenuPosition();
  }

  function handleTabContextMenu(event: MouseEvent, tab: AppTab): void {
    void openWorldContextMenu(event, tab);
  }

  function handleWorldContextMenuAction(action: () => void): void {
    closeWorldContextMenu();
    action();
  }

  onMount(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (menuContainer && !menuContainer.contains(event.target as Node)) {
        menuOpen = false;
      }

      if (quickConnectContainer && !quickConnectContainer.contains(event.target as Node)) {
        quickConnectOpen = false;
      }

      if (worldContextMenuDropdown && !worldContextMenuDropdown.contains(event.target as Node)) {
        worldContextMenuOpen = false;
      }

      if (closeConfirmDropdown && !closeConfirmDropdown.contains(event.target as Node)) {
        if (isCloseConfirmDropdownOpen()) {
          closeConfirmAnchorRect = null;
          onCancelCloseConfirm();
        }
      }
    };

    const handleDocumentContextMenu = (event: MouseEvent) => {
      if (worldContextMenuDropdown && !worldContextMenuDropdown.contains(event.target as Node)) {
        worldContextMenuOpen = false;
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        menuOpen = false;
        quickConnectOpen = false;
        closeWorldContextMenu();
        closeConfirmAnchorRect = null;
        onCancelCloseConfirm();
      }
    };

    const handleResize = () => {
      if (quickConnectOpen) {
        updateQuickConnectSide();
      }

      if (worldContextMenuOpen) {
        updateWorldContextMenuPosition();
      }

      if (isCloseConfirmDropdownOpen()) {
        updateCloseConfirmPosition();
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('contextmenu', handleDocumentContextMenu);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
    };
  });

  async function minimizeWindow(): Promise<void> {
    if (!isTauriAvailable()) {
      return;
    }

    await invoke('window_minimize');
  }

  async function toggleMaximizeWindow(): Promise<void> {
    if (!isTauriAvailable()) {
      return;
    }

    await invoke('window_toggle_maximize');
  }

  async function closeWindow(): Promise<void> {
    if (!isTauriAvailable()) {
      return;
    }

    await invoke('window_close');
  }

</script>

<header id="titlebar" data-tauri-drag-region>
  <div id="titlebar-brand" aria-hidden="true">
    <span class="titlebar-app-name">MUDShow</span>
  </div>

  <div id="titlebar-tabs">
    <div class="world-tabs" aria-label="app tabs">
      {#each tabs as tab}
        {@const worldSession = tab.kind === 'world' ? worldSessions[tab.id] ?? null : null}
        <div
          class="world-tab-group"
          class:active={tab.id === activeTabId}
          class:confirming={closeConfirmMode === 'dropdown' && closeConfirmTabId === tab.id}
          role="group"
          aria-label={`${tab.title} tab`}
          on:contextmenu={(event) => handleTabContextMenu(event, tab)}
        >
          <button
            type="button"
            class="world-tab"
            title={tab.title}
            aria-label={tab.title}
            on:click={() => {
              closeWorldContextMenu();
              onSelectTab(tab.id);
            }}
          >
            {tab.title}
          </button>

          {#if tab.closable}
            <button
              bind:this={tabCloseButtons[tab.id]}
            type="button"
            class="world-tab-close"
            title={`close ${tab.title}`}
            aria-label={`close ${tab.title}`}
            on:click|stopPropagation={(event) => {
              setCloseConfirmAnchor(event.currentTarget);
              closeWorldContextMenu();
              onCloseTab(tab.id, 'mouse');
            }}
          >
              X
            </button>
          {/if}

          {#if tab.kind === 'world'}
            <div class="world-tab-status" aria-hidden="true">
              <StatusDot status={worldSession?.connectionStatus ?? 'idle'} />
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if isCloseConfirmDropdownOpen() && closeConfirmTab}
      <div
        bind:this={closeConfirmDropdown}
        class="titlebar-dropdown titlebar-close-confirm-dropdown"
        role="menu"
        aria-label="close tab confirmation"
        style={`left: ${closeConfirmPosition.x}px; top: ${closeConfirmPosition.y}px;`}
      >
        <p class="titlebar-close-confirm-copy">World {closeConfirmWorldName} is connected.</p>
        <div class="titlebar-close-confirm-actions">
          <button
            type="button"
            class="titlebar-menu-item titlebar-close-confirm-item danger"
            role="menuitem"
            on:click={() => onConfirmCloseTab()}
          >
            disconnect and close
          </button>
        </div>
      </div>
    {/if}

    <div class="titlebar-quick-connect" bind:this={quickConnectContainer}>
      <button
        type="button"
        class="world-tab world-tab-add"
        title="open quick connect menu"
        aria-label="open quick connect menu"
        aria-expanded={quickConnectOpen}
        bind:this={quickConnectButton}
        on:click={toggleQuickConnect}
      >
        +
      </button>

      {#if quickConnectOpen}
        <div
          bind:this={quickConnectDropdown}
          class="titlebar-dropdown titlebar-quick-connect-dropdown"
          data-side={quickConnectSide}
        >
          <QuickConnectPanel
            worlds={worlds}
            characters={characters}
            onConnectWorld={(worldId) => {
              closeQuickConnect();
              onConnectWorld(worldId);
            }}
            onConnectCharacter={(index) => {
              closeQuickConnect();
              onConnectCharacter(index);
            }}
            onOpenWorldsAndCharacters={() => {
              closeQuickConnect();
              onOpenCharactersTab();
            }}
          />
        </div>
      {/if}
    </div>
  </div>

  {#if worldContextMenuOpen && worldContextMenuTab}
    <div
      bind:this={worldContextMenuDropdown}
      class="titlebar-dropdown titlebar-context-menu"
      role="menu"
      aria-label={`tab menu for ${worldContextMenuTab.title}`}
      style={`left: ${worldContextMenuPosition.x}px; top: ${worldContextMenuPosition.y}px;`}
    >
      {#if worldContextMenuTab.kind === 'world'}
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          disabled={!worldContextMenuCanReconnect}
          on:click={() => worldContextMenuCanReconnect && handleWorldContextMenuAction(() => onReconnectTab(worldContextMenuTab.id))}
        >
          reconnect
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          disabled={!worldContextMenuCanDisconnect}
          on:click={() => worldContextMenuCanDisconnect && handleWorldContextMenuAction(() => onDisconnectTab(worldContextMenuTab.id))}
        >
          disconnect
        </button>

        <div class="titlebar-context-menu-separator" aria-hidden="true"></div>
      {/if}

      <button
        type="button"
        class="titlebar-menu-item titlebar-context-menu-item"
        role="menuitem"
        on:click={() => handleWorldContextMenuAction(() => onCloseTab(worldContextMenuTab.id, 'mouse'))}
      >
        close
      </button>
    </div>
  {/if}

  <div id="titlebar-actions" bind:this={menuContainer}>
    <div class="titlebar-menu">
      <button
        type="button"
        class="titlebar-button titlebar-menu-button"
        title="app menu"
        aria-label="app menu"
        aria-expanded={menuOpen}
        on:click={toggleMenu}
      >
        ☰
      </button>

      {#if menuOpen}
        <div class="titlebar-menu-dropdown" role="menu" aria-label="app menu">
          <button
            type="button"
            class="titlebar-menu-item"
            role="menuitem"
            on:click={() => {
              closeMenu();
              onSelectTab(CHARACTERS_TAB_ID);
            }}
          >
            worlds and characters
          </button>
          <button
            type="button"
            class="titlebar-menu-item"
            role="menuitem"
            on:click={() => {
              closeMenu();
              onSelectTab(SETTINGS_TAB_ID);
            }}
          >
            app settings
          </button>
        </div>
      {/if}
    </div>

    <div class="window-controls" aria-label="window controls">
      <button
        type="button"
        class="titlebar-button window-button"
        title="minimize window"
        aria-label="minimize window"
        on:click={minimizeWindow}
      >
        -
      </button>
      <button
        type="button"
        class="titlebar-button window-button"
        title="maximize window"
        aria-label="maximize window"
        on:click={toggleMaximizeWindow}
      >
        □
      </button>
      <button
        type="button"
        class="titlebar-button window-button close"
        title="close window"
        aria-label="close window"
        on:click={closeWindow}
      >
        ×
      </button>
    </div>
  </div>
</header>
