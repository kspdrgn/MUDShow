<script lang="ts">
  import type { HighlightRule } from '../types';
  import { getWorldHighlightInputId, getWorldHighlightsPanelId } from '../world-dom';

  export let open = false;
  export let highlights: HighlightRule[] = [];
  export let scope = 'world';
  export let onAdd: (pattern: string, color: string) => void;
  export let onDelete: (index: number) => void;

  let pattern = '';
  let color = '#f1c40f';

  function handleAdd(): void {
    onAdd(pattern, color);
    pattern = '';
  }
</script>

<div class="highlights-panel" id={getWorldHighlightsPanelId(scope)} class:open={open}>
  <div class="highlights-label">highlights</div>
  <div class="highlights-list">
    {#if highlights.length === 0}
      <div style="padding:0.5rem 0.8rem;color:var(--text-dim);font-size:0.8rem;">no highlights yet</div>
    {:else}
      {#each highlights as rule, index}
        <div class="highlight-row">
          <div class="highlight-swatch" style={`background:${rule.color}`}></div>
          <span class="highlight-pattern">{rule.pattern}</span>
          <button class="btn danger" on:click={() => onDelete(index)}>del</button>
        </div>
      {/each}
    {/if}
  </div>
  <form class="highlights-add" on:submit|preventDefault={handleAdd}>
    <input
      id={getWorldHighlightInputId(scope)}
      type="text"
      bind:value={pattern}
      placeholder="text to highlight..."
      autocomplete="off"
      spellcheck="false"
    />
    <input type="color" bind:value={color} />
    <button class="btn primary" type="submit">add</button>
  </form>
</div>
