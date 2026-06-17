<script lang="ts">
  import type { Character } from '../types';

  export let characters: Character[] = [];
  export let onConnect: (index: number) => void;
  export let onEdit: (index: number) => void;
  export let onDelete: (index: number) => void;
  export let onAdd: () => void;
</script>

<div id="screen-list">
  <h1>MUDShow</h1>

  {#if characters.length === 0}
    <div id="empty-state">no characters yet - add one below</div>
  {/if}

  {#if characters.length > 0}
    <div id="char-list">
      {#each characters as character, index}
        <div class="char-row">
          <span class="char-name">{character.name}</span>
          <span class="char-host">{character.host}:{character.port}</span>
          <div class="char-actions">
            <button class="btn primary" on:click={() => onConnect(index)}>connect</button>
            <button class="btn" on:click={() => onEdit(index)}>edit</button>
            <button class="btn danger" on:click={() => onDelete(index)}>del</button>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <div id="list-footer">
    <button class="btn primary" on:click={onAdd}>+ add character</button>
  </div>
</div>
