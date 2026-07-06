<script lang="ts">
  import type { CharacterRecord, WorldRecord } from '../types';

  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let onConnectWorld: (worldId: string) => void;
  export let onConnectCharacter: (index: number) => void;
  export let onOpenWorldsAndCharacters: () => void;

  function getWorldCharacters(worldId: string): CharacterRecord[] {
    return characters.filter((character) => character.worldId === worldId);
  }
</script>

<section class="quick-connect-panel">
  <h2>quick connect</h2>

  {#if worlds.length === 0}
    <div class="titlebar-dropdown-empty">
      <p>no saved worlds yet</p>
    </div>
  {:else}
    <div class="titlebar-quick-connect-list">
      {#each worlds as world}
        {@const worldCharacters = getWorldCharacters(world.id)}

        <button
          type="button"
          class="titlebar-quick-connect-row"
          disabled={worldCharacters.length === 0}
          on:click={() => onConnectWorld(world.id)}
        >
          <span class="titlebar-quick-connect-name">{world.name}</span>
          <span class="titlebar-quick-connect-meta">{world.host}:{world.port}</span>
          <span class="titlebar-quick-connect-action">
            {#if worldCharacters.length > 0}
              connect
            {:else}
              no characters
            {/if}
          </span>
        </button>

        <div class="titlebar-quick-connect-tree">
          {#each worldCharacters.filter((character) => !character.isDefault) as character}
            <button
              type="button"
              class="titlebar-quick-connect-row titlebar-quick-connect-child"
              on:click={() => onConnectCharacter(characters.findIndex((entry) => entry.id === character.id))}
            >
              <span class="titlebar-quick-connect-name">{character.name}</span>
              <!--
              <span class="titlebar-quick-connect-meta">
                {character.sound ? 'sound on' : 'sound off'} · history {character.outputHistoryLines ?? 0}
              </span>
              -->
              <span class="titlebar-quick-connect-action">connect</span>
            </button>
          {/each}
        </div>
      {/each}
    </div>
  {/if}

  <div class="titlebar-dropdown-footer">
    <button
      type="button"
      class="titlebar-menu-item titlebar-quick-connect-action-item"
      on:click={onOpenWorldsAndCharacters}
    >
      ⚙ Edit Worlds and Characters
    </button>
  </div>
</section>
