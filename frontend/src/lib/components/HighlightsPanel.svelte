<script lang="ts">
  import type { HighlightRule } from '../types';

  export let open = false;
  export let highlights: HighlightRule[] = [];
  export let highlightInput = '';
  export let highlightColor = '#f1c40f';
  export let onAdd: () => void;
  export let onDelete: (index: number) => void;
  let highlightInputEl: HTMLInputElement | null = null;

  export function focus(): void {
    highlightInputEl?.focus();
  }
</script>

<div id="highlights-panel" class:open={open}>
  <div id="highlights-label">highlights</div>
  <div id="highlights-list">
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
  <form id="highlights-add" on:submit|preventDefault={onAdd}>
    <input
      bind:this={highlightInputEl}
      type="text"
      bind:value={highlightInput}
      placeholder="text to highlight..."
      autocomplete="off"
      spellcheck="false"
    />
    <input type="color" bind:value={highlightColor} />
    <button class="btn primary" type="submit">add</button>
  </form>
</div>
