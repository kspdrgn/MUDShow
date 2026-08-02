<script lang="ts">
  import ContextMenuShell from '../context-menu/ContextMenuShell.svelte';

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

  function handleAction(action: () => void): void {
    action();
    onDismiss();
  }
</script>

<ContextMenuShell
  {open}
  {position}
  {ariaLabel}
  source="spellcheck"
  className="titlebar-context-menu spellcheck-context-menu"
  onDismiss={onDismiss}
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
</ContextMenuShell>
