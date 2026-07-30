<script lang="ts">
  import { onMount, tick } from 'svelte';

  export let open = false;
  export let position = { x: 0, y: 0 };
  export let ariaLabel = 'context menu';
  export let source: 'titlebar' | 'transcript' = 'titlebar';
  export let canReconnect = false;
  export let canDisconnect = false;
  export let canQuickLog = false;
  export let canStopLogging = false;
  export let canEditWorld = false;
  export let canEditCharacter = false;
  export let transcriptZoom = 1;
  export let onReconnect: () => void;
  export let onDisconnect: () => void;
  export let onQuickLog: () => void;
  export let onStopLogging: () => void;
  export let onOpenLogging: () => void;
  export let onEditWorld: () => void;
  export let onEditCharacter: () => void;
  export let onOpenNotes: () => void;
  export let onOpenDebugConsole: () => void;
  export let onOpenTriggers: () => void;
  export let onOpenStyles: () => void;
  export let onZoomIn: () => void = () => {};
  export let onZoomOut: () => void = () => {};
  export let onZoomReset: () => void = () => {};
  export let onDismiss: () => void;
  export let onCloseRequest: (anchorRect: DOMRect) => void;
  let menuElement: HTMLDivElement | null = null;
  let settingsButtonElement: HTMLButtonElement | null = null;
  let settingsSubmenuElement: HTMLDivElement | null = null;
  let settingsSubmenuOpen = false;
  let settingsSubmenuPosition = { x: 0, y: 0 };
  let settingsSubmenuSide: 'left' | 'right' = 'right';
  let settingsSubmenuCloseTimeout: ReturnType<typeof setTimeout> | null = null;
  let renderedPosition = position;
  let repositionToken = 0;

  function dismissMenu(): void {
    settingsSubmenuOpen = false;
    clearSettingsSubmenuCloseTimeout();
    onDismiss();
  }

  function clearSettingsSubmenuCloseTimeout(): void {
    if (settingsSubmenuCloseTimeout !== null) {
      clearTimeout(settingsSubmenuCloseTimeout);
      settingsSubmenuCloseTimeout = null;
    }
  }

  function scheduleCloseSettingsSubmenu(): void {
    clearSettingsSubmenuCloseTimeout();
    settingsSubmenuCloseTimeout = setTimeout(() => {
      settingsSubmenuOpen = false;
      settingsSubmenuCloseTimeout = null;
    }, 160);
  }

  function updateSettingsSubmenuPosition(): void {
    if (!settingsSubmenuOpen || !settingsButtonElement || !settingsSubmenuElement) {
      return;
    }

    const margin = 8;
    const gap = 8;
    const buttonRect = settingsButtonElement.getBoundingClientRect();
    const submenuRect = settingsSubmenuElement.getBoundingClientRect();

    const preferRight = buttonRect.right + gap + submenuRect.width <= window.innerWidth - margin;
    const rawX = preferRight
      ? buttonRect.right + gap
      : buttonRect.left - gap - submenuRect.width;
    const rawY = buttonRect.top;

    settingsSubmenuSide = preferRight ? 'right' : 'left';
    settingsSubmenuPosition = {
      x: Math.max(margin, Math.min(rawX, window.innerWidth - submenuRect.width - margin)),
      y: Math.max(margin, Math.min(rawY, window.innerHeight - submenuRect.height - margin)),
    };
  }

  onMount(() => {
    const handleMenuOpen = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { source?: string } : null;
      if (!open || detail?.source === source) {
        return;
      }

      dismissMenu();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!open) {
        return;
      }

      if (!(event.target instanceof Node)) {
        dismissMenu();
        return;
      }

      if (menuElement?.contains(event.target) || settingsSubmenuElement?.contains(event.target)) {
        return;
      }

      dismissMenu();
    };

    const handleDocumentContextMenu = (event: MouseEvent) => {
      if (!open) {
        return;
      }

      if (!(event.target instanceof Node)) {
        dismissMenu();
        return;
      }

      if (menuElement?.contains(event.target) || settingsSubmenuElement?.contains(event.target)) {
        return;
      }

      dismissMenu();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        dismissMenu();
      }
    };

    document.addEventListener('click', handleDocumentClick);
    document.addEventListener('contextmenu', handleDocumentContextMenu);
    window.addEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);
    window.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      window.removeEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);
      window.removeEventListener('keydown', handleEscape);
    };
  });

  $: if (open) {
    renderedPosition = position;
    const token = ++repositionToken;

    void tick().then(() => {
      if (!open || token !== repositionToken || !menuElement) {
        return;
      }

      const margin = 8;
      const rect = menuElement.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - margin;
      const maxY = window.innerHeight - rect.height - margin;

      renderedPosition = {
        x: position.x > maxX ? Math.max(margin, maxX) : position.x,
        y: position.y > maxY ? Math.max(margin, maxY) : position.y,
      };
    });
  } else {
    repositionToken += 1;
    renderedPosition = position;
    settingsSubmenuOpen = false;
    clearSettingsSubmenuCloseTimeout();
  }

  $: if (settingsSubmenuOpen) {
    clearSettingsSubmenuCloseTimeout();
    void tick().then(() => updateSettingsSubmenuPosition());
  } else {
    clearSettingsSubmenuCloseTimeout();
  }

  function handleCloseClick(event: MouseEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    settingsSubmenuOpen = false;
    clearSettingsSubmenuCloseTimeout();
    onCloseRequest(target.getBoundingClientRect());
  }

  function openSettingsSubmenu(): void {
    clearSettingsSubmenuCloseTimeout();
    settingsSubmenuOpen = true;
  }

  function closeSettingsSubmenu(): void {
    clearSettingsSubmenuCloseTimeout();
    settingsSubmenuOpen = false;
  }

  function runMenuAction(action: () => void): void {
    dismissMenu();
    action();
  }
</script>

{#if open}
  <div
    bind:this={menuElement}
    class="titlebar-dropdown titlebar-context-menu"
    role="menu"
    tabindex="-1"
    aria-label={ariaLabel}
    style={`left: ${renderedPosition.x}px; top: ${renderedPosition.y}px;`}
    on:click|stopPropagation
    on:contextmenu|preventDefault
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        dismissMenu();
      }
    }}
  >
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      disabled={!canReconnect && !canDisconnect}
      on:click={() => {
        if (canDisconnect) {
          onDisconnect();
        } else if (canReconnect) {
          onReconnect();
        }
      }}
    >
      {canDisconnect ? 'disconnect' : 'reconnect'}
    </button>

    <div class="titlebar-context-menu-separator" aria-hidden="true"></div>

    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      disabled={!canQuickLog && !canStopLogging}
      on:click={() => {
        if (canStopLogging) {
          onStopLogging();
        } else if (canQuickLog) {
          onQuickLog();
        }
      }}
    >
      {canStopLogging ? 'stop logging' : 'start logging'}
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      on:click={() => runMenuAction(onOpenLogging)}
    >
      logging...
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item titlebar-context-menu-item-shortcut"
      role="menuitem"
      on:click={() => runMenuAction(onOpenNotes)}
    >
      <span class="titlebar-context-menu-item-label">notes</span>
      <span class="titlebar-context-menu-shortcut" aria-hidden="true">F3</span>
    </button>
    <div class="titlebar-context-menu-separator" aria-hidden="true"></div>

    <div
      class="titlebar-context-menu-settings-group"
      on:mouseenter={openSettingsSubmenu}
      on:mouseleave={scheduleCloseSettingsSubmenu}
      on:focusin={openSettingsSubmenu}
      on:focusout={(event) => {
        const relatedTarget = event.relatedTarget;
        const currentTarget = event.currentTarget;
        if (!(currentTarget instanceof HTMLElement)) {
          closeSettingsSubmenu();
          return;
        }

        if (
          !(relatedTarget instanceof Node) ||
          (!currentTarget.contains(relatedTarget) && !settingsSubmenuElement?.contains(relatedTarget))
        ) {
          scheduleCloseSettingsSubmenu();
        }
      }}
    >
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item titlebar-context-menu-settings-button"
      bind:this={settingsButtonElement}
      role="menuitem"
      aria-haspopup="menu"
      aria-expanded={settingsSubmenuOpen}
      on:click={openSettingsSubmenu}
      on:mouseenter={openSettingsSubmenu}
      on:mouseleave={scheduleCloseSettingsSubmenu}
      on:focus={openSettingsSubmenu}
    >
      <span class="titlebar-context-menu-item-label">settings</span>
      <span class="titlebar-context-menu-shortcut" aria-hidden="true">▶</span>
    </button>
    </div>

    {#if settingsSubmenuOpen}
      <div
        bind:this={settingsSubmenuElement}
        class="titlebar-dropdown titlebar-context-menu titlebar-context-menu-submenu-panel"
        role="menu"
        aria-label="world settings shortcuts"
        data-side={settingsSubmenuSide}
        style={`left: ${settingsSubmenuPosition.x}px; top: ${settingsSubmenuPosition.y}px;`}
        on:mouseenter={openSettingsSubmenu}
        on:mouseleave={scheduleCloseSettingsSubmenu}
        on:contextmenu|preventDefault
        on:click|stopPropagation
        on:keydown={(event) => {
          if (event.key === 'Escape') {
            dismissMenu();
          }
        }}
      >
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          disabled={!canEditWorld}
          on:click={() => canEditWorld && runMenuAction(onEditWorld)}
        >
          edit world
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          disabled={!canEditCharacter}
          on:click={() => canEditCharacter && runMenuAction(onEditCharacter)}
        >
          edit character
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item titlebar-context-menu-item-shortcut"
          role="menuitem"
          on:click={() => runMenuAction(onOpenStyles)}
        >
          <span class="titlebar-context-menu-item-label">edit styles</span>
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          on:click={() => runMenuAction(onOpenTriggers)}
        >
          edit triggers
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          on:click={() => runMenuAction(onOpenDebugConsole)}
        >
          debug console
        </button>
      </div>
    {/if}

    {#if source === 'transcript'}
      <div class="titlebar-context-menu-separator" aria-hidden="true"></div>

      <div class="titlebar-context-menu-zoom-row" role="none" aria-label="zoom controls">
        <span class="titlebar-context-menu-zoom-label">zoom</span>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item titlebar-context-menu-zoom-button"
          role="menuitem"
          aria-label="zoom out"
          title="Zoom out - CTRL+'-' or CTRL+Mousewheel Down"
          on:click={onZoomOut}
        >
          −
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item titlebar-context-menu-zoom-button titlebar-context-menu-zoom-value"
          role="menuitem"
          aria-label="reset zoom"
          title="Reset zoom level"
          on:click={onZoomReset}
        >
          {Math.round(transcriptZoom * 100)}%
        </button>
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item titlebar-context-menu-zoom-button"
          role="menuitem"
          aria-label="zoom in"
          title="Zoom in - CTRL+'+' or CTRL+Mousewheel Up"
          on:click={onZoomIn}
        >
          +
        </button>
      </div>

      <div class="titlebar-context-menu-separator" aria-hidden="true"></div>
    {/if}

    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      on:click={(event) => {
        closeSettingsSubmenu();
        handleCloseClick(event);
      }}
    >
      close
    </button>
  </div>
{/if}
