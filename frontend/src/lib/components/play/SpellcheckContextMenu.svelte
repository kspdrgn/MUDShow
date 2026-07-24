<script lang="ts">
  import { onMount, tick } from 'svelte';

  export let open = false;
  export let position = { x: 0, y: 0 };
  export let ariaLabel = 'spellcheck context menu';
  export let suggestions: string[] = [];
  export let loading = false;
  export let onDismiss: () => void;
  export let onCopy: () => void;
  export let onCut: () => void;
  export let onPaste: () => void;
  export let onSelectAll: () => void;
  export let onIgnoreOnce: () => void;
  export let onIgnoreAlways: () => void;
  export let onChooseSuggestion: (suggestion: string) => void;

  let menuElement: HTMLDivElement | null = null;
  let renderedPosition = position;
  let repositionToken = 0;

  onMount(() => {
    const handleMenuOpen = (event: Event) => {
      const detail = event instanceof CustomEvent ? (event.detail as { source?: string }) : null;
      if (!open || detail?.source === 'spellcheck') {
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
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);

    return () => {
      document.removeEventListener('click', handleDocumentClick);
      document.removeEventListener('contextmenu', handleDocumentContextMenu);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('mudshow-context-menu-open', handleMenuOpen as EventListener);
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

  function handleAction(action: () => void): void {
    action();
    onDismiss();
  }
</script>

{#if open}
  <div
    bind:this={menuElement}
    class="titlebar-dropdown titlebar-context-menu spellcheck-context-menu"
    role="menu"
    tabindex="-1"
    aria-label={ariaLabel}
    style={`left: ${renderedPosition.x}px; top: ${renderedPosition.y}px;`}
    on:click|stopPropagation
    on:contextmenu|preventDefault
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        onDismiss();
      }
    }}
  >
    <button type="button" class="titlebar-menu-item titlebar-context-menu-item" role="menuitem" on:click={() => handleAction(onCopy)}>
      copy
    </button>
    <button type="button" class="titlebar-menu-item titlebar-context-menu-item" role="menuitem" on:click={() => handleAction(onCut)}>
      cut
    </button>
    <button type="button" class="titlebar-menu-item titlebar-context-menu-item" role="menuitem" on:click={() => handleAction(onPaste)}>
      paste
    </button>
    <button type="button" class="titlebar-menu-item titlebar-context-menu-item" role="menuitem" on:click={() => handleAction(onSelectAll)}>
      select all
    </button>

    <div class="titlebar-context-menu-separator" aria-hidden="true"></div>

    <button type="button" class="titlebar-menu-item titlebar-context-menu-item" role="menuitem" on:click={() => handleAction(onIgnoreOnce)}>
      ignore once
    </button>
    <button type="button" class="titlebar-menu-item titlebar-context-menu-item" role="menuitem" on:click={() => handleAction(onIgnoreAlways)}>
      ignore always
    </button>

    <div class="titlebar-context-menu-separator" aria-hidden="true"></div>

    {#if suggestions.length > 0}
      {#each suggestions as suggestion}
        <button
          type="button"
          class="titlebar-menu-item titlebar-context-menu-item"
          role="menuitem"
          on:click={() => handleAction(() => onChooseSuggestion(suggestion))}
        >
          {suggestion}
        </button>
      {/each}
    {:else if loading}
      <button type="button" class="titlebar-menu-item titlebar-context-menu-item" role="menuitem" disabled>
        loading spelling suggestions...
      </button>
    {:else}
      <button type="button" class="titlebar-menu-item titlebar-context-menu-item" role="menuitem" disabled>
        no spelling suggestions yet
      </button>
    {/if}
  </div>
{/if}
