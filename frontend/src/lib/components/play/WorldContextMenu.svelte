<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import ContextMenuShell from '../context-menu/ContextMenuShell.svelte';
  import { createDelayedCloseController, positionSubmenu } from '../context-menu/context-menu';

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
  let settingsButtonElement: HTMLButtonElement | null = null;
  let settingsSubmenuElement: HTMLDivElement | null = null;
  let settingsSubmenuOpen = false;
  let settingsSubmenuPosition = { x: 0, y: 0 };
  let settingsSubmenuSide: 'left' | 'right' = 'right';
  let settingsSubmenuPositionToken = 0;
  const settingsSubmenuCloseController = createDelayedCloseController(() => {
    settingsSubmenuOpen = false;
  });

  function dismissMenu(): void {
    settingsSubmenuOpen = false;
    settingsSubmenuCloseController.clear();
    onDismiss();
  }

  function scheduleCloseSettingsSubmenu(): void {
    settingsSubmenuCloseController.scheduleClose();
  }

  function updateSettingsSubmenuPosition(): void {
    if (!settingsSubmenuOpen || !settingsButtonElement || !settingsSubmenuElement) {
      return;
    }

    const buttonRect = settingsButtonElement.getBoundingClientRect();
    const submenuRect = settingsSubmenuElement.getBoundingClientRect();
    const next = positionSubmenu(
      buttonRect,
      { width: submenuRect.width, height: submenuRect.height },
      { width: window.innerWidth, height: window.innerHeight },
    );

    settingsSubmenuSide = next.side;
    settingsSubmenuPosition = next.position;
  }

  $: if (!open) {
    settingsSubmenuOpen = false;
    settingsSubmenuPositionToken += 1;
    settingsSubmenuCloseController.clear();
  }

  $: if (settingsSubmenuOpen) {
    settingsSubmenuCloseController.clear();
    const token = ++settingsSubmenuPositionToken;
    void tick().then(() => {
      if (!settingsSubmenuOpen || token !== settingsSubmenuPositionToken) {
        return;
      }

      updateSettingsSubmenuPosition();
    });
  } else {
    settingsSubmenuCloseController.clear();
  }

  function handleCloseClick(event: MouseEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    settingsSubmenuOpen = false;
    settingsSubmenuCloseController.clear();
    onCloseRequest(target.getBoundingClientRect());
  }

  function openSettingsSubmenu(): void {
    settingsSubmenuCloseController.clear();
    settingsSubmenuOpen = true;
  }

  function closeSettingsSubmenu(): void {
    settingsSubmenuCloseController.clear();
    settingsSubmenuOpen = false;
  }

  function runMenuAction(action: () => void): void {
    dismissMenu();
    action();
  }

  onDestroy(() => {
    settingsSubmenuCloseController.dispose();
  });
</script>

<ContextMenuShell
  {open}
  {position}
  {ariaLabel}
  {source}
  className="titlebar-context-menu"
  onDismiss={dismissMenu}
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
      role="group"
      aria-label="settings submenu trigger"
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
        tabindex="-1"
        aria-label="world settings shortcuts"
        data-side={settingsSubmenuSide}
        style={`position: fixed; right: auto; left: ${settingsSubmenuPosition.x}px; top: ${settingsSubmenuPosition.y}px;`}
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

      <div class="titlebar-context-menu-zoom-row" role="group" aria-label="zoom controls">
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
</ContextMenuShell>
