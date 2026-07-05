<script lang="ts">
  import type { Character } from '../types';

  export let open = false;
  export let characters: Character[] = [];
  export let onCancel: () => void;
  export let onConnect: (index: number) => void;
  export let onAddCharacter: () => void;
</script>

{#if open}
  <div
    id="world-selector-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label="close world selector"
    on:click|self={onCancel}
    on:keydown={(event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onCancel();
      }
    }}
  >
    <div id="world-selector">
      <h2>connection selector</h2>

      {#if characters.length === 0}
        <div class="world-selector-empty">
          <p>no saved worlds yet</p>
          <button class="btn primary" type="button" on:click={onAddCharacter}>
            add a world
          </button>
        </div>
      {:else}
        <div class="world-selector-list">
          {#each characters as character, index}
            <button class="world-selector-row" type="button" on:click={() => onConnect(index)}>
              <span class="world-selector-name">{character.name}</span>
              <span class="world-selector-meta">{character.host}:{character.port}</span>
              <span class="world-selector-action">connect</span>
            </button>
          {/each}
        </div>

        <div class="world-selector-footer">
          <button class="btn primary" type="button" on:click={onAddCharacter}>
            add a world
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
