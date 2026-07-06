<script lang="ts">
  import type { CharacterRecord, WorldRecord } from '../types';

  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let onOpenWorld: (index: number | null) => void;
  export let onEditWorld: (index: number) => void;
  export let onDeleteWorld: (index: number) => void;
  export let onOpenCharacter: (worldId: string, index: number | null) => void;
  export let onEditCharacter: (index: number) => void;
  export let onDeleteCharacter: (index: number) => void;
  export let onConnectCharacter: (index: number) => void;
</script>

<div id="screen-list">
  <h1>worlds and characters</h1>

  {#if worlds.length === 0}
    <div id="empty-state">no worlds yet - add one below</div>
  {/if}

  <div id="char-list">
    {#each worlds as world, worldIndex}
      {@const worldCharacters = characters.filter((character) => character.worldId === world.id)}
      {@const defaultCharacter = worldCharacters.find((character) => character.isDefault) ?? null}
      <div
        class="char-row"
        role="button"
        tabindex="0"
        on:click={() => {
          if (!defaultCharacter) {
            return;
          }

          const defaultIndex = characters.findIndex((character) => character.id === defaultCharacter.id);
          if (defaultIndex >= 0) {
            onConnectCharacter(defaultIndex);
          }
        }}
        on:keydown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') {
            return;
          }

          event.preventDefault();
          if (!defaultCharacter) {
            return;
          }

          const defaultIndex = characters.findIndex((character) => character.id === defaultCharacter.id);
          if (defaultIndex >= 0) {
            onConnectCharacter(defaultIndex);
          }
        }}
      >
        <div>
          <div class="char-name">{world.name}</div>
          <div class="char-host">{world.host}:{world.port}</div>
        </div>
        <div class="char-actions">
          <button
            class="btn primary"
            disabled={defaultCharacter === null}
            on:click|stopPropagation={() => {
              if (!defaultCharacter) {
                return;
              }

              const defaultIndex = characters.findIndex((character) => character.id === defaultCharacter.id);
              if (defaultIndex >= 0) {
                onConnectCharacter(defaultIndex);
              }
            }}
          >
            connect
          </button>
          <button class="btn primary" on:click|stopPropagation={() => onOpenCharacter(world.id, null)}>+ character</button>
          <button class="btn" on:click|stopPropagation={() => onEditWorld(worldIndex)}>edit world</button>
          <button class="btn danger" on:click|stopPropagation={() => onDeleteWorld(worldIndex)}>del world</button>
        </div>
      </div>

      {#each worldCharacters.filter((character) => !character.isDefault) as character}
        <div class="char-row" style="margin-left: 1rem;">
          <div>
            <div class="char-name">{character.name}</div>
            <div class="char-host">
              {character.sound ? 'sound on' : 'sound off'} · history {character.outputHistoryLines ?? 0}
            </div>
          </div>
          <div class="char-actions">
            <button class="btn primary" on:click={() => onConnectCharacter(characters.indexOf(character))}>connect</button>
            <button class="btn" on:click={() => onEditCharacter(characters.indexOf(character))}>edit</button>
            <button class="btn danger" on:click={() => onDeleteCharacter(characters.indexOf(character))}>del</button>
          </div>
        </div>
      {/each}
    {/each}
  </div>

  <div id="list-footer">
    <button class="btn primary" on:click={() => onOpenWorld(null)}>+ add world</button>
  </div>
</div>
