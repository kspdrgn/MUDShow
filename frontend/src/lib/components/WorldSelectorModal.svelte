<script lang="ts">
  import type { CharacterRecord, WorldRecord } from '../types';

  export let open = false;
  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let onCancel: () => void;
  export let onConnectWorld: (worldId: string) => void;
  export let onConnectCharacter: (index: number) => void;
  export let onAddWorld: () => void;
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

      {#if worlds.length === 0}
        <div class="world-selector-empty">
          <p>no saved worlds yet</p>
          <button class="btn primary" type="button" on:click={onAddWorld}>
            add a world
          </button>
        </div>
      {:else}
        <div class="world-selector-list">
          {#each worlds as world}
            {@const worldCharacters = characters.filter((character) => character.worldId === world.id)}
            {@const defaultCharacter = worldCharacters.find((character) => character.isDefault) ?? null}

            <button class="world-selector-row" type="button" on:click={() => onConnectWorld(world.id)}>
              <span class="world-selector-name">{world.name}</span>
              <span class="world-selector-meta">{world.host}:{world.port}</span>
              <span class="world-selector-action">
                {#if defaultCharacter}
                  connect default
                {:else}
                  no default
                {/if}
              </span>
            </button>

            <div class="world-selector-tree">
              {#if defaultCharacter}
                <div class="world-selector-child world-selector-child-default">
                  <span class="world-selector-name">default</span>
                  <span class="world-selector-meta">connect without a character</span>
                </div>
              {/if}

              {#each worldCharacters.filter((character) => !character.isDefault) as character}
                <button class="world-selector-row world-selector-child" type="button" on:click={() => onConnectCharacter(characters.indexOf(character))}>
                  <span class="world-selector-name">{character.name}</span>
                  <span class="world-selector-meta">
                    {character.sound ? 'sound on' : 'sound off'} · history {character.outputHistoryLines ?? 0}
                  </span>
                  <span class="world-selector-action">connect</span>
                </button>
              {/each}
            </div>
          {/each}
        </div>

        <div class="world-selector-footer">
          <button class="btn primary" type="button" on:click={onAddWorld}>
            add a world
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
