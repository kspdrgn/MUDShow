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
  export let onReconnect: () => void;
  export let onDisconnect: () => void;
  export let onQuickLog: () => void;
  export let onStopLogging: () => void;
  export let onOpenLogging: () => void;
  export let onEditWorld: () => void;
  export let onEditCharacter: () => void;
  export let onOpenNotes: () => void;
  export let onOpenHighlights: () => void;
  export let onDismiss: () => void;
  export let onCloseRequest: (anchorRect: DOMRect) => void;
  let menuElement: HTMLDivElement | null = null;
  let renderedPosition = position;
  let repositionToken = 0;

  onMount(() => {
    const handleMenuOpen = (event: Event) => {
      const detail = event instanceof CustomEvent ? event.detail as { source?: string } : null;
      if (!open || detail?.source === source) {
        return;
      }

      onDismiss();
    };

    const handleDocumentClick = (event: MouseEvent) => {
      if (!open) {
        return;
      }

      if (!(event.target instanceof Node)) {
        onDismiss();
        return;
      }

      if (menuElement?.contains(event.target)) {
        return;
      }

      onDismiss();
    };

    const handleDocumentContextMenu = (event: MouseEvent) => {
      if (!open) {
        return;
      }

      if (!(event.target instanceof Node)) {
        onDismiss();
        return;
      }

      if (menuElement?.contains(event.target)) {
        return;
      }

      onDismiss();
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onDismiss();
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
  }

  function handleCloseClick(event: MouseEvent): void {
    const target = event.currentTarget;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    onCloseRequest(target.getBoundingClientRect());
  }
</script>

{#if open}
  <div
    bind:this={menuElement}
    class="titlebar-dropdown titlebar-context-menu"
    role="menu"
    aria-label={ariaLabel}
    style={`left: ${renderedPosition.x}px; top: ${renderedPosition.y}px;`}
    on:click|stopPropagation
    on:contextmenu|preventDefault
  >
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      disabled={!canReconnect}
      on:click={() => canReconnect && onReconnect()}
    >
      reconnect
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      disabled={!canDisconnect}
      on:click={() => canDisconnect && onDisconnect()}
    >
      disconnect
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      disabled={!canQuickLog}
      on:click={() => canQuickLog && onQuickLog()}
    >
      quick log
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      disabled={!canStopLogging}
      on:click={() => canStopLogging && onStopLogging()}
    >
      stop logging
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      on:click={onOpenLogging}
    >
      logging...
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      disabled={!canEditWorld}
      on:click={() => canEditWorld && onEditWorld()}
    >
      edit world
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      disabled={!canEditCharacter}
      on:click={() => canEditCharacter && onEditCharacter()}
    >
      edit character
    </button>

    <div class="titlebar-context-menu-separator" aria-hidden="true"></div>

    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item titlebar-context-menu-item-shortcut"
      role="menuitem"
      on:click={onOpenNotes}
    >
      <span class="titlebar-context-menu-item-label">notes</span>
      <span class="titlebar-context-menu-shortcut" aria-hidden="true">F3</span>
    </button>
    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item titlebar-context-menu-item-shortcut"
      role="menuitem"
      on:click={onOpenHighlights}
    >
      <span class="titlebar-context-menu-item-label">highlights</span>
      <span class="titlebar-context-menu-shortcut" aria-hidden="true">F4</span>
    </button>

    <div class="titlebar-context-menu-separator" aria-hidden="true"></div>

    <button
      type="button"
      class="titlebar-menu-item titlebar-context-menu-item"
      role="menuitem"
      on:click={handleCloseClick}
    >
      close
    </button>
  </div>
{/if}
