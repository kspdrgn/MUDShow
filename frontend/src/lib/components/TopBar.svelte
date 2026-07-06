<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { isTauriAvailable, invoke } from '../tauri';
  import { CHARACTERS_TAB_ID, SETTINGS_TAB_ID, type AppTab } from '../tabs';
  import type { CharacterRecord, WorldRecord } from '../types';

  export let tabs: AppTab[] = [];
  export let activeTabId: string | null = null;
  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let onSelectTab: (tabId: string) => void;
  export let onCloseTab: (tabId: string) => void;
  export let onConnectWorld: (worldId: string) => void;
  export let onConnectCharacter: (index: number) => void;
  export let onOpenCharactersTab: () => void;

  let menuOpen = false;
  let quickConnectOpen = false;
  let quickConnectSide: 'left' | 'right' = 'right';
  let menuContainer: HTMLDivElement | null = null;
  let quickConnectContainer: HTMLDivElement | null = null;
  let quickConnectButton: HTMLButtonElement | null = null;
  let quickConnectDropdown: HTMLDivElement | null = null;

  function toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    menuOpen = !menuOpen;
    if (menuOpen) {
      quickConnectOpen = false;
    }
  }

  function toggleQuickConnect(event: MouseEvent): void {
    event.stopPropagation();
    quickConnectOpen = !quickConnectOpen;
    if (quickConnectOpen) {
      menuOpen = false;
      void tick().then(updateQuickConnectSide);
    }
  }

  function closeMenu(): void {
    menuOpen = false;
  }

  function closeQuickConnect(): void {
    quickConnectOpen = false;
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

  onMount(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (menuContainer && !menuContainer.contains(event.target as Node)) {
        menuOpen = false;
      }

      if (quickConnectContainer && !quickConnectContainer.contains(event.target as Node)) {
        quickConnectOpen = false;
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        menuOpen = false;
        quickConnectOpen = false;
      }
    };

    const handleResize = () => {
      if (quickConnectOpen) {
        updateQuickConnectSide();
      }
    };

    document.addEventListener('click', handleDocumentClick);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
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

  function getWorldCharacters(worldId: string): CharacterRecord[] {
    return characters.filter((character) => character.worldId === worldId);
  }
</script>

<header id="titlebar" data-tauri-drag-region>
  <div id="titlebar-brand" aria-hidden="true">
    <span class="titlebar-app-name">MUDShow</span>
  </div>

  <div id="titlebar-tabs">
    <div class="world-tabs" aria-label="app tabs">
      {#each tabs as tab}
        <div class="world-tab-group" class:active={tab.id === activeTabId}>
          <button
            type="button"
            class:active={tab.id === activeTabId}
            class="world-tab"
            title={tab.title}
            aria-label={tab.title}
            on:click={() => onSelectTab(tab.id)}
          >
            {tab.title}
          </button>

          {#if tab.closable}
            <button
              type="button"
              class="world-tab-close"
              title={`close ${tab.title}`}
              aria-label={`close ${tab.title}`}
              on:click|stopPropagation={() => onCloseTab(tab.id)}
            >
              ×
            </button>
          {/if}
        </div>
      {/each}
    </div>

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
          role="menu"
          aria-label="quick connect menu"
        >
          {#if worlds.length === 0}
            <div class="titlebar-dropdown-empty">
              <p>no saved worlds yet</p>
            </div>
          {:else}
            <div class="titlebar-quick-connect-list">
              {#each worlds as world}
                {@const worldCharacters = getWorldCharacters(world.id)}

                <button
                  type="button"
                  class="titlebar-quick-connect-row"
                  role="menuitem"
                  disabled={worldCharacters.length === 0}
                  on:click={() => {
                    closeQuickConnect();
                    onConnectWorld(world.id);
                  }}
                >
                  <span class="titlebar-quick-connect-name">{world.name}</span>
                  <span class="titlebar-quick-connect-meta">{world.host}:{world.port}</span>
                  <span class="titlebar-quick-connect-action">{#if worldCharacters.length > 0}connect{:else}no characters{/if}</span>
                </button>

                <div class="titlebar-quick-connect-tree">
                  {#each worldCharacters.filter((character) => !character.isDefault) as character}
                    <button
                      type="button"
                      class="titlebar-quick-connect-row titlebar-quick-connect-child"
                      role="menuitem"
                      on:click={() => {
                        closeQuickConnect();
                        onConnectCharacter(characters.indexOf(character));
                      }}
                    >
                      <span class="titlebar-quick-connect-name">{character.name}</span>
                      <span class="titlebar-quick-connect-meta">
                        {character.sound ? 'sound on' : 'sound off'} · history {character.outputHistoryLines ?? 0}
                      </span>
                      <span class="titlebar-quick-connect-action">connect</span>
                    </button>
                  {/each}
                </div>
              {/each}
            </div>
          {/if}

          <div class="titlebar-dropdown-footer">
            <button
              type="button"
              class="titlebar-menu-item titlebar-quick-connect-action-item"
              role="menuitem"
              on:click={() => {
                closeQuickConnect();
                onOpenCharactersTab();
              }}
            >
              ⚙ Edit Worlds and Characters
            </button>
          </div>
        </div>
      {/if}
    </div>
  </div>

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
