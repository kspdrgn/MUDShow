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
  export let onReorderTab: (tabId: string, targetIndex: number) => void;
  export let onCloseTab: (tabId: string, source?: 'mouse' | 'shortcut') => void;
  export let onCancelCloseConfirm: () => void;
  export let onConfirmCloseTab: () => void;
  export let onReconnectTab: (tabId: string) => void;
  export let onDisconnectTab: (tabId: string) => void;
  export let onQuickLogTab: (tabId: string) => void;
  export let onOpenLoggingTab: (tabId: string) => void;
  export let onStopLoggingTab: (tabId: string) => void;
  export let onConnectWorld: (worldId: string) => void;
  export let onConnectCharacter: (index: number) => void;
  export let onOpenCharactersTab: () => void;
  export let onEditWorldTab: (tabId: string) => void;
  export let onEditCharacterTab: (tabId: string) => void;

  const canOpenInspector = import.meta.env.DEV && isTauriAvailable();
  let menuOpen = false;
  let quickConnectOpen = false;
  let worldContextMenuOpen = false;
  let worldContextMenuTabId: string | null = null;
  let quickConnectSide: 'left' | 'right' = 'right';
  let titlebarElement: HTMLElement | null = null;
  let titlebarTabsElement: HTMLDivElement | null = null;
  let menuContainer: HTMLDivElement | null = null;
  let quickConnectContainer: HTMLDivElement | null = null;
  let quickConnectButton: HTMLButtonElement | null = null;
  let quickConnectDropdown: HTMLDivElement | null = null;
  let worldTabsElement: HTMLDivElement | null = null;
  let worldContextMenuDropdown: HTMLDivElement | null = null;
  let worldContextMenuPosition = { x: 0, y: 0 };
  let worldContextMenuTab: AppTab | null = null;
  let worldContextMenuSession: WorldTabSessionState | null = null;
  let worldContextMenuCanReconnect = false;
  let worldContextMenuCanDisconnect = false;
  let worldContextMenuCanQuickLog = false;
  let worldContextMenuCanStopLogging = false;
  let worldContextMenuCanEditWorld = false;
  let worldContextMenuCanEditCharacter = false;
  let closeConfirmDropdown: HTMLDivElement | null = null;
  let closeConfirmPosition = { x: 0, y: 0 };
  let closeConfirmAnchorRect: DOMRect | null = null;
  let closeConfirmTab: AppTab | null = null;
  let closeConfirmWorldName = '';
  const tabCloseButtons: Record<string, HTMLButtonElement | null> = {};
  const tabGroupElements: Record<string, HTMLDivElement | null> = {};
  const TAB_DRAG_THRESHOLD = 6;

  type TabDragState = {
    tabId: string;
    pointerId: number;
    pointerTarget: HTMLElement | null;
    startX: number;
    startY: number;
    clientX: number;
    clientY: number;
    isDragging: boolean;
    dropIndex: number;
    indicatorLeft: number;
  };

  let tabDragState: TabDragState | null = null;
  let suppressTabClickId: string | null = null;
  let suppressTabClickTimeout: ReturnType<typeof setTimeout> | null = null;

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
    worldContextMenuSession.currentCharacter !== null;
  $: worldContextMenuCanDisconnect =
    worldContextMenuTab?.kind === 'world' &&
    worldContextMenuSession !== null &&
    (worldContextMenuSession.connectionStatus === 'connecting' ||
      worldContextMenuSession.connectionStatus === 'connected');
  $: worldContextMenuCanQuickLog =
    worldContextMenuTab?.kind === 'world' &&
    worldContextMenuSession !== null &&
    !worldContextMenuSession.loggingActive;
  $: worldContextMenuCanStopLogging =
    worldContextMenuTab?.kind === 'world' &&
    worldContextMenuSession !== null &&
    worldContextMenuSession.loggingActive;
  $: worldContextMenuCanEditWorld =
    worldContextMenuTab?.kind === 'world' &&
    worldContextMenuSession !== null &&
    worldContextMenuSession.currentWorld !== null;
  $: worldContextMenuCanEditCharacter =
    worldContextMenuTab?.kind === 'world' &&
    worldContextMenuSession !== null &&
    worldContextMenuSession.currentCharacter !== null &&
    !worldContextMenuSession.currentCharacter.isDefault;
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

  function closeTabDrag(): void {
    const drag = tabDragState;
    if (drag?.pointerTarget && drag.pointerTarget.hasPointerCapture(drag.pointerId)) {
      drag.pointerTarget.releasePointerCapture(drag.pointerId);
    }

    tabDragState = null;
  }

  function clearSuppressedTabClick(): void {
    if (suppressTabClickTimeout !== null) {
      clearTimeout(suppressTabClickTimeout);
      suppressTabClickTimeout = null;
    }

    suppressTabClickId = null;
  }

  function scheduleSuppressedTabClick(tabId: string): void {
    clearSuppressedTabClick();
    suppressTabClickId = tabId;
    suppressTabClickTimeout = setTimeout(() => {
      if (suppressTabClickId === tabId) {
        suppressTabClickId = null;
      }

      suppressTabClickTimeout = null;
    }, 0);
  }

  function updateTabDragIndicator(clientX: number): void {
    const drag = tabDragState;
    if (!drag) {
      return;
    }

    const draggedTabId = drag.tabId;
    const otherTabs = tabs.filter((tab) => tab.id !== draggedTabId);
    const containerRect = titlebarTabsElement?.getBoundingClientRect();

    if (!containerRect) {
      tabDragState = {
        ...drag,
        dropIndex: otherTabs.length,
        indicatorLeft: 0,
        clientX,
        clientY: drag.clientY,
      };
      return;
    }

    let dropIndex = otherTabs.length;
    let indicatorLeft = containerRect.width;

    for (let index = 0; index < otherTabs.length; index += 1) {
      const tab = otherTabs[index];
      const element = tabGroupElements[tab.id];
      const rect = element?.getBoundingClientRect();

      if (!rect) {
        continue;
      }

      const midpoint = rect.left + rect.width / 2;
      if (clientX < midpoint) {
        dropIndex = index;
        indicatorLeft = rect.left - containerRect.left - 2;
        break;
      }
    }

    if (dropIndex === otherTabs.length) {
      const quickConnectRect = quickConnectContainer?.getBoundingClientRect() ?? null;
      const lastTab = otherTabs[otherTabs.length - 1];
      const rect = lastTab ? tabGroupElements[lastTab.id]?.getBoundingClientRect() ?? null : null;
      indicatorLeft = quickConnectRect
        ? quickConnectRect.left - containerRect.left - 3
        : rect
          ? rect.right - containerRect.left + 3
          : containerRect.width;
    }

    tabDragState = {
      ...drag,
      dropIndex,
      indicatorLeft: Math.max(0, indicatorLeft),
      clientX,
      clientY: drag.clientY,
    };
  }

  function beginTabDrag(event: PointerEvent, tab: AppTab): void {
    if (tabDragState !== null || event.button !== 0 || !event.isPrimary || suppressTabClickId === tab.id) {
      return;
    }

    if (!(event.currentTarget instanceof HTMLElement)) {
      return;
    }

    closeWorldContextMenu();
    menuOpen = false;
    quickConnectOpen = false;

    tabDragState = {
      tabId: tab.id,
      pointerId: event.pointerId,
      pointerTarget: event.currentTarget,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      isDragging: false,
      dropIndex: Math.max(0, tabs.filter((item) => item.id !== tab.id).length),
      indicatorLeft: 0,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTabDrag(event: PointerEvent): void {
    const drag = tabDragState;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const distanceX = Math.abs(event.clientX - drag.startX);
    const distanceY = Math.abs(event.clientY - drag.startY);

    if (!drag.isDragging) {
      if (distanceX < TAB_DRAG_THRESHOLD && distanceY < TAB_DRAG_THRESHOLD) {
        return;
      }

      tabDragState = {
        ...drag,
        isDragging: true,
      };
    }

    event.preventDefault();
    updateTabDragIndicator(event.clientX);
  }

  function finishTabDrag(event: PointerEvent, commit = true): void {
    const drag = tabDragState;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const shouldCommit = commit && drag.isDragging;
    const targetIndex = drag.dropIndex;
    const tabId = drag.tabId;

    closeTabDrag();

    if (shouldCommit) {
      onReorderTab(tabId, targetIndex);
      scheduleSuppressedTabClick(tabId);
    }
  }

  function cancelTabDrag(event: PointerEvent): void {
    finishTabDrag(event, false);
  }

  function handleTabClick(event: MouseEvent, tab: AppTab): void {
    if (suppressTabClickId === tab.id) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    closeWorldContextMenu();
    onSelectTab(tab.id);
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
        if (tabDragState?.isDragging) {
          event.preventDefault();
          closeTabDrag();
        }

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

      if (tabDragState?.isDragging) {
        updateTabDragIndicator(tabDragState.clientX);
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('contextmenu', handleDocumentContextMenu);
    titlebarElement?.addEventListener('mousedown', startTitlebarDrag);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', handleResize);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      titlebarElement?.removeEventListener('mousedown', startTitlebarDrag);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', handleResize);
      clearSuppressedTabClick();
      closeTabDrag();
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

  async function openInspector(): Promise<void> {
    if (!isTauriAvailable()) {
      return;
    }

    try {
      await invoke('window_open_devtools');
    } catch (error) {
      console.error('failed to open the web inspector', error);
    }
  }

  function shouldStartTitlebarDrag(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) {
      return false;
    }

    return target.closest(
      '.world-tab-group, .titlebar-quick-connect, .titlebar-dropdown, #titlebar-actions, button, input, textarea, select, a',
    ) === null;
  }

  function startTitlebarDrag(event: MouseEvent): void {
    if (event.button !== 0 || !shouldStartTitlebarDrag(event.target)) {
      return;
    }

    event.preventDefault();
    void invoke('window_start_dragging').catch((error) => {
      console.error('failed to start window drag', error);
    });
  }

</script>

<header id="titlebar" data-tauri-drag-region bind:this={titlebarElement}>
  <div id="titlebar-brand" aria-hidden="true">
    <span class="titlebar-app-name">MUDShow</span>
  </div>

  <div id="titlebar-tabs" bind:this={titlebarTabsElement}>
    <div class="world-tabs" aria-label="app tabs" bind:this={worldTabsElement} class:dragging={tabDragState?.isDragging}>
      {#each tabs as tab (tab.id)}
        {@const worldSession = tab.kind === 'world' ? worldSessions[tab.id] ?? null : null}
        <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
        <div
          bind:this={tabGroupElements[tab.id]}
          class="world-tab-group"
          class:active={tab.id === activeTabId}
          class:confirming={closeConfirmMode === 'dropdown' && closeConfirmTabId === tab.id}
          class:drag-source={tabDragState?.tabId === tab.id && tabDragState.isDragging}
          role="group"
          aria-label={`${tab.title} tab`}
          on:pointerdown={(event) => beginTabDrag(event, tab)}
          on:pointermove={moveTabDrag}
          on:pointerup={(event) => finishTabDrag(event)}
          on:pointercancel={cancelTabDrag}
          on:click={(event) => handleTabClick(event, tab)}
          on:contextmenu={(event) => handleTabContextMenu(event, tab)}
        >
          <button
            type="button"
            class="world-tab"
            title={tab.title}
            aria-label={tab.title}
            aria-grabbed={tabDragState?.tabId === tab.id && tabDragState.isDragging}
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
              on:pointerdown|stopPropagation
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
              {#if worldSession?.loggingActive}
                <StatusDot status="connected" variant="logging" />
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if tabDragState?.isDragging}
      <div
        class="world-tab-drop-indicator"
        aria-hidden="true"
        style={`left: ${tabDragState.indicatorLeft}px;`}
      ></div>
    {/if}

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

    <!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
    <div class="titlebar-quick-connect" bind:this={quickConnectContainer} on:click={toggleQuickConnect}>
      <button
        type="button"
        class="world-tab world-tab-add"
        title="open quick connect menu"
        aria-label="open quick connect menu"
        aria-expanded={quickConnectOpen}
        bind:this={quickConnectButton}
      >
        +
      </button>

      {#if quickConnectOpen}
        <div
          bind:this={quickConnectDropdown}
          class="titlebar-dropdown titlebar-quick-connect-dropdown"
          data-side={quickConnectSide}
          on:click|stopPropagation
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
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          disabled={!worldContextMenuCanQuickLog}
          on:click={() => worldContextMenuCanQuickLog && handleWorldContextMenuAction(() => onQuickLogTab(worldContextMenuTab.id))}
        >
          quick log
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          disabled={!worldContextMenuCanStopLogging}
          on:click={() => worldContextMenuCanStopLogging && handleWorldContextMenuAction(() => onStopLoggingTab(worldContextMenuTab.id))}
        >
          stop logging
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          on:click={() => handleWorldContextMenuAction(() => onOpenLoggingTab(worldContextMenuTab.id))}
        >
          logging...
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          disabled={!worldContextMenuCanEditWorld}
          on:click={() => worldContextMenuCanEditWorld && handleWorldContextMenuAction(() => onEditWorldTab(worldContextMenuTab.id))}
        >
          edit world
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          disabled={!worldContextMenuCanEditCharacter}
          on:click={() =>
            worldContextMenuCanEditCharacter &&
            handleWorldContextMenuAction(() => onEditCharacterTab(worldContextMenuTab.id))
          }
        >
          edit character
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
          <button
            type="button"
            class="titlebar-menu-item"
            role="menuitem"
            disabled={!canOpenInspector}
            on:click={() => {
              closeMenu();
              void openInspector();
            }}
          >
            dev tools
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
