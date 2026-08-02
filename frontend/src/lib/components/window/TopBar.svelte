<script lang="ts">
  import { onMount, tick } from 'svelte';
  import ContextMenuShell from '../context-menu/ContextMenuShell.svelte';
  import { createDelayedCloseController, positionSubmenu } from '../context-menu/context-menu';
  import { isTauriAvailable } from '../../tauri';
  import {
    CHARACTERS_TAB_ID,
    SETTINGS_TAB_ID,
    type AppTab,
  } from '../../tabs';
  import type { CharacterRecord, WorldRecord } from '../../types';
  import StatusDot from '../play/StatusDot.svelte';
  import WorldContextMenu from '../play/WorldContextMenu.svelte';
  import type { WorldTabSessionState } from '../../world-session';
  import QuickConnectPanel from './QuickConnectPanel.svelte';
  import {
    getCloseConfirmState,
    getQuickConnectSide,
    getWorldContextMenuState,
  } from './topbar-state';
  import {
    TAB_DRAG_THRESHOLD,
    calculateTabDragPosition,
    createSuppressedTabClickScheduler,
    createTabDragState,
    type TabDragState,
  } from './topbar-drag';
  import {
    closeWindow,
    minimizeWindow,
    openInspector,
    startTitlebarDrag,
    toggleMaximizeWindow,
  } from './window-actions';

  export let tabs: AppTab[] = [];
  export let activeTabId: string | null = null;
  export let worldSessions: Record<string, WorldTabSessionState> = {};
  export let closeConfirmTabId: string | null = null;
  export let closeConfirmMode: 'modal' | 'dropdown' | null = null;
  export let confirmUnloggedTabClose = false;
  export let transcriptDiagnosticsEnabled = false;
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
  export let onOpenNotesTab: (tabId: string) => void;
  export let onOpenDebugConsoleTab: (tabId: string) => void;
  export let onOpenTriggersTab: (worldId: string | null, characterId: string | null) => void;
  export let onOpenStylesTab: () => void;
  export let onToggleTranscriptDiagnostics: () => void;

  const canOpenInspector = import.meta.env.DEV && isTauriAvailable();
  let menuOpen = false;
  let quickConnectOpen = false;
  let worldContextMenuOpen = false;
  let worldContextMenuTabId: string | null = null;
  let quickConnectSide: 'left' | 'right' = 'right';
  let titlebarElement: HTMLElement | null = null;
  let titlebarTabsElement: HTMLDivElement | null = null;
  let quickConnectContainer: HTMLDivElement | null = null;
  let quickConnectButton: HTMLButtonElement | null = null;
  let quickConnectDropdown: HTMLDivElement | null = null;
  let appMenuButton: HTMLButtonElement | null = null;
  let appMenuPosition = { x: 0, y: 0 };
  let appMenuPositionToken = 0;
  let devToolsButton: HTMLButtonElement | null = null;
  let devToolsSubmenu: HTMLDivElement | null = null;
  let worldTabsElement: HTMLDivElement | null = null;
  let worldContextMenuDropdown: HTMLDivElement | null = null;
  let worldContextMenuPosition = { x: 0, y: 0 };
  let devToolsSubmenuPosition = { x: 0, y: 0 };
  let devToolsSubmenuSide: 'left' | 'right' = 'right';
  let devToolsSubmenuPositionToken = 0;
  const devToolsSubmenuCloseController = createDelayedCloseController(() => {
    devToolsSubmenuOpen = false;
  });
  let closeConfirmDropdown: HTMLDivElement | null = null;
  let closeConfirmPosition = { x: 0, y: 0 };
  let closeConfirmAnchorPoint: { x: number; y: number } | null = null;
  let devToolsSubmenuOpen = false;
  const tabCloseButtons: Record<string, HTMLButtonElement | null> = {};
  const tabGroupElements: Record<string, HTMLDivElement | null> = {};

  let tabDragState: TabDragState | null = null;
  const tabClickScheduler = createSuppressedTabClickScheduler();

  let worldContextMenuState = getWorldContextMenuState(worldContextMenuTabId, tabs, worldSessions);

  let closeConfirmState = getCloseConfirmState(
    closeConfirmTabId,
    closeConfirmMode,
    tabs,
    worldSessions,
    confirmUnloggedTabClose,
  );

  $: worldContextMenuState = getWorldContextMenuState(worldContextMenuTabId, tabs, worldSessions);

  $: closeConfirmState = getCloseConfirmState(
    closeConfirmTabId,
    closeConfirmMode,
    tabs,
    worldSessions,
    confirmUnloggedTabClose,
  );

  function isCloseConfirmDropdownOpen(): boolean {
    return closeConfirmState.isOpen;
  }

  function toggleMenu(event: MouseEvent): void {
    event.stopPropagation();
    if (menuOpen) {
      closeMenu();
      return;
    }

    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'titlebar' } }));
    menuOpen = true;
    quickConnectOpen = false;
    closeWorldContextMenu();
    closeDevToolsSubmenu();
    void tick().then(updateAppMenuPosition);
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
    closeDevToolsSubmenu();
  }

  function closeQuickConnect(): void {
    quickConnectOpen = false;
  }

  function openDevToolsSubmenu(): void {
    devToolsSubmenuCloseController.clear();
    devToolsSubmenuOpen = true;
  }

  function scheduleCloseDevToolsSubmenu(): void {
    devToolsSubmenuCloseController.scheduleClose();
  }

  function closeDevToolsSubmenu(): void {
    devToolsSubmenuOpen = false;
    devToolsSubmenuCloseController.clear();
  }

  function updateDevToolsSubmenuPosition(): void {
    if (!devToolsSubmenuOpen || !devToolsButton || !devToolsSubmenu) {
      return;
    }

    const buttonRect = devToolsButton.getBoundingClientRect();
    const submenuRect = devToolsSubmenu.getBoundingClientRect();
    const next = positionSubmenu(
      buttonRect,
      { width: submenuRect.width, height: submenuRect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );

    devToolsSubmenuSide = next.side;
    devToolsSubmenuPosition = next.position;
  }

  function updateAppMenuPosition(): void {
    if (!menuOpen || !appMenuButton) {
      return;
    }

    const buttonRect = appMenuButton.getBoundingClientRect();
    appMenuPosition = {
      x: buttonRect.right - 300,
      y: buttonRect.bottom + 8,
    };
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

  function updateTabDragIndicator(clientX: number): void {
    const drag = tabDragState;
    if (!drag) {
      return;
    }
    tabDragState = {
      ...drag,
      ...calculateTabDragPosition(drag, clientX, {
        tabs,
        tabGroupElements,
        titlebarTabsElement,
        quickConnectContainer,
      }),
    };
  }

  function beginTabDrag(event: PointerEvent, tab: AppTab): void {
    if (tabDragState !== null || event.button !== 0 || !event.isPrimary || tabClickScheduler.suppressTabClickId === tab.id) {
      return;
    }

    if (!(event.currentTarget instanceof HTMLElement)) {
      return;
    }

    closeWorldContextMenu();
    menuOpen = false;
    quickConnectOpen = false;
    closeDevToolsSubmenu();

    tabDragState = createTabDragState(tab, event, tabs);

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
      tabClickScheduler.scheduleSuppressedTabClick(tabId);
    }
  }

  function cancelTabDrag(event: PointerEvent): void {
    finishTabDrag(event, false);
  }

  function handleTabClick(event: MouseEvent, tab: AppTab): void {
    if (tabClickScheduler.suppressTabClickId === tab.id) {
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

    if (!closeConfirmAnchorPoint || !closeConfirmDropdown) {
      return;
    }

    const margin = 8;
    const dropdownRect = closeConfirmDropdown.getBoundingClientRect();
    const preferredLeft = closeConfirmAnchorPoint.x - dropdownRect.width / 2;
    const preferredTop = closeConfirmAnchorPoint.y + 10;
    const maxLeft = window.innerWidth - dropdownRect.width - margin;
    const maxTop = window.innerHeight - dropdownRect.height - margin;

    closeConfirmPosition = {
      x: Math.max(margin, Math.min(preferredLeft, maxLeft)),
      y: Math.max(margin, Math.min(preferredTop, maxTop)),
    };
  }

  $: if (isCloseConfirmDropdownOpen()) {
    void tick().then(updateCloseConfirmPosition);
  }

  $: if (menuOpen) {
    const token = ++appMenuPositionToken;
    void tick().then(() => {
      if (!menuOpen || token !== appMenuPositionToken) {
        return;
      }

      updateAppMenuPosition();
    });
  } else {
    appMenuPositionToken += 1;
  }

  $: if (devToolsSubmenuOpen) {
    const token = ++devToolsSubmenuPositionToken;
    void tick().then(() => {
      if (!devToolsSubmenuOpen || token !== devToolsSubmenuPositionToken) {
        return;
      }

      updateDevToolsSubmenuPosition();
    });
  } else {
    devToolsSubmenuPositionToken += 1;
    devToolsSubmenuCloseController.clear();
  }

  function updateQuickConnectSide(): void {
    if (!quickConnectOpen || !quickConnectButton) {
      return;
    }

    const dropdownWidth = quickConnectDropdown?.offsetWidth ?? 420;
    const buttonRect = quickConnectButton.getBoundingClientRect();
    const availableRight = window.innerWidth - buttonRect.left;
    quickConnectSide = getQuickConnectSide(availableRight, dropdownWidth);
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
    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'titlebar' } }));
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

  function beginWorldTabClose(event: MouseEvent, tab: AppTab): void {
    closeConfirmAnchorPoint = {
      x: event.clientX,
      y: event.clientY,
    };
    closeConfirmPosition = {
      x: event.clientX,
      y: event.clientY + 10,
    };
    closeWorldContextMenu();
    onCloseTab(tab.id, 'mouse');
  }

  onMount(() => {
    const handleDocumentClick = (event: MouseEvent) => {
      if (quickConnectContainer && !quickConnectContainer.contains(event.target as Node)) {
        quickConnectOpen = false;
      }

      if (closeConfirmDropdown && !closeConfirmDropdown.contains(event.target as Node)) {
        if (isCloseConfirmDropdownOpen()) {
          closeConfirmAnchorPoint = null;
          onCancelCloseConfirm();
        }
      }

      if (devToolsButton && devToolsSubmenu && !devToolsButton.contains(event.target as Node) && !devToolsSubmenu.contains(event.target as Node)) {
        closeDevToolsSubmenu();
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
          return;
        }

        quickConnectOpen = false;
        closeConfirmAnchorPoint = null;
        onCancelCloseConfirm();
      }
    };

    const handleResize = () => {
      if (menuOpen) {
        updateAppMenuPosition();
      }

      if (quickConnectOpen) {
        updateQuickConnectSide();
      }

      if (devToolsSubmenuOpen) {
        updateDevToolsSubmenuPosition();
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
      tabClickScheduler.clearSuppressedTabClick();
      closeTabDrag();
      closeDevToolsSubmenu();
      devToolsSubmenuCloseController.dispose();
    };
  });

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
              on:click|stopPropagation={(event) => beginWorldTabClose(event, tab)}
            >
              X
            </button>
          {/if}

          {#if tab.kind === 'world'}
            <div class="world-tab-status" aria-hidden="true">
              <StatusDot status={worldSession?.connectionStatus ?? 'idle'} />
              <StatusDot status="connected" variant="activity" active={worldSession?.hasNewActivity === true} />
              <StatusDot status="connected" variant="logging" active={worldSession?.loggingActive === true} />
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

    {#if isCloseConfirmDropdownOpen() && closeConfirmState.tab}
      <div
        bind:this={closeConfirmDropdown}
        class="titlebar-dropdown titlebar-close-confirm-dropdown"
        role="menu"
        aria-label="close tab confirmation"
        style={`left: ${closeConfirmPosition.x}px; top: ${closeConfirmPosition.y}px;`}
      >
        <p class="titlebar-close-confirm-copy">{closeConfirmState.message}</p>
        <div class="titlebar-close-confirm-actions">
          <button
            type="button"
            class="titlebar-menu-item titlebar-close-confirm-item danger"
            role="menuitem"
            on:click={() => onConfirmCloseTab()}
          >
            {closeConfirmState.actionLabel}
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

  {#if worldContextMenuOpen && worldContextMenuState.tab}
    <div bind:this={worldContextMenuDropdown}>
      <WorldContextMenu
        open={worldContextMenuOpen}
        position={worldContextMenuPosition}
        ariaLabel={`tab menu for ${worldContextMenuState.tab.title}`}
        source="titlebar"
        canReconnect={worldContextMenuState.canReconnect}
        canDisconnect={worldContextMenuState.canDisconnect}
        canQuickLog={worldContextMenuState.canQuickLog}
        canStopLogging={worldContextMenuState.canStopLogging}
        canEditWorld={worldContextMenuState.canEditWorld}
        canEditCharacter={worldContextMenuState.canEditCharacter}
        onReconnect={() =>
          worldContextMenuState.canReconnect &&
          handleWorldContextMenuAction(() => onReconnectTab(worldContextMenuState.tab.id))
        }
        onDisconnect={() =>
          worldContextMenuState.canDisconnect &&
          handleWorldContextMenuAction(() => onDisconnectTab(worldContextMenuState.tab.id))
        }
        onQuickLog={() =>
          worldContextMenuState.canQuickLog &&
          handleWorldContextMenuAction(() => onQuickLogTab(worldContextMenuState.tab.id))
        }
        onStopLogging={() =>
          worldContextMenuState.canStopLogging &&
          handleWorldContextMenuAction(() => onStopLoggingTab(worldContextMenuState.tab.id))
        }
        onOpenLogging={() => handleWorldContextMenuAction(() => onOpenLoggingTab(worldContextMenuState.tab.id))}
        onEditWorld={() =>
          worldContextMenuState.canEditWorld &&
          handleWorldContextMenuAction(() => onEditWorldTab(worldContextMenuState.tab.id))
        }
        onEditCharacter={() =>
          worldContextMenuState.canEditCharacter &&
          handleWorldContextMenuAction(() => onEditCharacterTab(worldContextMenuState.tab.id))
        }
        onOpenNotes={() => handleWorldContextMenuAction(() => onOpenNotesTab(worldContextMenuState.tab.id))}
        onOpenDebugConsole={() =>
          handleWorldContextMenuAction(() => onOpenDebugConsoleTab(worldContextMenuState.tab.id))
        }
        onOpenTriggers={() =>
          handleWorldContextMenuAction(() =>
            onOpenTriggersTab(
              worldContextMenuState.session?.currentWorld?.id ?? null,
              worldContextMenuState.session?.currentCharacter?.id ?? null,
            ),
          )
        }
        onOpenStyles={() => handleWorldContextMenuAction(() => onOpenStylesTab())}
        onDismiss={closeWorldContextMenu}
        onCloseRequest={(rect) =>
          beginWorldTabClose(
            new MouseEvent('click', {
              clientX: rect.left + rect.width / 2,
              clientY: rect.bottom,
            }),
            worldContextMenuState.tab,
          )}
      />
    </div>
  {/if}

  <div id="titlebar-actions">
    <div class="titlebar-menu">
      <button
        type="button"
        class="titlebar-button titlebar-menu-button"
        title="app menu"
        aria-label="app menu"
        aria-expanded={menuOpen}
        bind:this={appMenuButton}
        on:click={toggleMenu}
      >
        ☰
      </button>

      <ContextMenuShell
        open={menuOpen}
        position={appMenuPosition}
        ariaLabel="app menu"
        source="titlebar"
        className="titlebar-menu-dropdown"
        onDismiss={closeMenu}
      >
        <button
          type="button"
          class="titlebar-menu-item"
          role="menuitem"
          on:click={() => {
            closeMenu();
            onSelectTab(CHARACTERS_TAB_ID);
          }}
        >
          <span class="titlebar-menu-item-icon" aria-hidden="true">🌐</span>
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
          <span class="titlebar-menu-item-icon" aria-hidden="true">⚙️</span>
          app settings
        </button>
        <button
          type="button"
          class="titlebar-menu-item"
          role="menuitem"
          on:click={() => {
            closeMenu();
            onOpenTriggersTab(null, null);
          }}
        >
          <span class="titlebar-menu-item-icon" aria-hidden="true">⏱</span>
          triggers
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-menu-item-submenu"
          bind:this={devToolsButton}
          role="menuitem"
          aria-haspopup="menu"
          aria-expanded={devToolsSubmenuOpen}
          on:click={() => {
            if (devToolsSubmenuOpen) {
              closeDevToolsSubmenu();
            } else {
              openDevToolsSubmenu();
            }
          }}
          on:mouseenter={openDevToolsSubmenu}
          on:mouseleave={scheduleCloseDevToolsSubmenu}
          on:focus={openDevToolsSubmenu}
        >
          <span class="titlebar-menu-item-icon" aria-hidden="true">🔧</span>
          <span>dev tools</span>
          <span class="titlebar-menu-submenu-arrow" aria-hidden="true">▶</span>
        </button>
        {#if devToolsSubmenuOpen}
          <div
            bind:this={devToolsSubmenu}
            class="titlebar-dropdown titlebar-menu-submenu-panel"
            role="menu"
            tabindex="-1"
            aria-label="dev tools submenu"
            data-side={devToolsSubmenuSide}
            style={`position: fixed; right: auto; left: ${devToolsSubmenuPosition.x}px; top: ${devToolsSubmenuPosition.y}px;`}
            on:mouseenter={openDevToolsSubmenu}
            on:mouseleave={scheduleCloseDevToolsSubmenu}
            on:click|stopPropagation
            on:contextmenu|preventDefault
            on:keydown={(event) => {
              if (event.key === 'Escape') {
                closeMenu();
              }
            }}
          >
            <button
              type="button"
              class="titlebar-menu-item titlebar-menu-submenu-item"
              role="menuitem"
              disabled={!canOpenInspector}
              on:click={() => {
                closeMenu();
                if (canOpenInspector) {
                  void openInspector();
                }
              }}
            >
              <span class="titlebar-menu-item-icon" aria-hidden="true">🪟</span>
              webview inspector
            </button>
            <button
              type="button"
              class="titlebar-menu-item titlebar-menu-submenu-item"
              class:active={transcriptDiagnosticsEnabled}
              role="menuitemcheckbox"
              aria-checked={transcriptDiagnosticsEnabled}
              on:click={() => {
                closeMenu();
                onToggleTranscriptDiagnostics();
              }}
            >
              <span class="titlebar-menu-item-icon" aria-hidden="true">🪲</span>
              {transcriptDiagnosticsEnabled ? 'disable transcript diagnostics' : 'enable transcript diagnostics'}
            </button>
          </div>
        {/if}
      </ContextMenuShell>
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
