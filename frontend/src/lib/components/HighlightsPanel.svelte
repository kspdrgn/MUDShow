<script lang="ts">
  import type { HighlightRule } from '../types';
  import { getWorldHighlightInputId, getWorldHighlightsPanelId } from '../world-dom';

  export let open = false;
  export let highlights: HighlightRule[] = [];
  export let scope = 'world';
  export let onAdd: (pattern: string, color: string) => void;
  export let onUpdatePattern: (index: number, pattern: string) => void;
  export let onUpdateColor: (index: number, color: string) => void;
  export let onToggleCaseSensitive: (index: number) => void;
  export let onToggleWordBoundary: (index: number) => void;
  export let onDelete: (index: number) => void;
  export let onOpenRules: () => void;
  export let onClose: () => void;

  let pattern = '';
  let color = '#f1c40f';

  function handleAdd(): void {
    const trimmed = pattern.trim();
    onAdd(trimmed, color);
    pattern = '';
  }
</script>

<div class="highlights-panel" id={getWorldHighlightsPanelId(scope)} class:open={open}>
  <div class="panel-header">
    <div class="panel-header-group">
      <div class="highlights-label">highlights</div>
      <button
        type="button"
        class="btn panel-tab"
        title="Open rules panel"
        on:click={onOpenRules}
      >
        rules
      </button>
    </div>
    <button
      type="button"
      class="btn panel-close"
      aria-label="Close highlights panel"
      title="Close highlights panel"
      on:click={onClose}
    >
      X
    </button>
  </div>
  <div class="highlights-list">
    {#if highlights.length === 0}
      <div style="padding:0.5rem 0.8rem;color:var(--text-dim);font-size:0.8rem;">no highlights yet</div>
    {:else}
      {#each highlights as rule, index}
        <div class="highlight-row">
          <input
            class="highlight-swatch-input"
            type="color"
            value={rule.color}
            aria-label={`Highlight color ${index + 1}`}
            title="Highlight color: click to open the color picker and change the rule color."
            on:change={(event) => onUpdateColor(index, (event.currentTarget as HTMLInputElement).value)}
          />
          <button
            type="button"
            class={`btn highlight-toggle${rule.caseSensitive ? ' active' : ''}`}
            title="Case sensitive: match uppercase and lowercase exactly as typed."
            aria-pressed={rule.caseSensitive}
            on:click={() => onToggleCaseSensitive(index)}
          >
            case
          </button>
          <button
            type="button"
            class={`btn highlight-toggle${rule.wordBoundary ? ' active' : ''}`}
            title="Word boundary: only match the text as a standalone word."
            aria-pressed={rule.wordBoundary}
            on:click={() => onToggleWordBoundary(index)}
          >
            word
          </button>
          <input
            class="highlight-pattern-input"
            type="text"
            value={rule.pattern}
            autocomplete="off"
            spellcheck="false"
            aria-label={`Highlight text ${index + 1}`}
            on:keydown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                (event.currentTarget as HTMLInputElement).blur();
              }
            }}
            on:blur={(event) => onUpdatePattern(index, (event.currentTarget as HTMLInputElement).value)}
          />
          <button type="button" class="btn danger" on:click={() => onDelete(index)}>del</button>
        </div>
      {/each}
    {/if}
  </div>
  <form class="highlights-add" on:submit|preventDefault={handleAdd}>
    <input
      id={getWorldHighlightInputId(scope)}
      type="text"
      bind:value={pattern}
      placeholder="enter text to highlight..."
      autocomplete="off"
      spellcheck="false"
      on:blur={() => {
        pattern = pattern.trim();
      }}
    />
    <input type="color" bind:value={color} />
    <button class="btn primary" type="submit">add</button>
  </form>
</div>
