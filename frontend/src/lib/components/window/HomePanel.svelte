<script lang="ts">
  import QuickConnectPanel from './QuickConnectPanel.svelte';
  import type { CharacterRecord, WorldRecord } from '../../types';

  export let worlds: WorldRecord[] = [];
  export let characters: CharacterRecord[] = [];
  export let onConnectWorld: (worldId: string) => void;
  export let onConnectCharacter: (index: number) => void;
  export let onOpenCharactersTab: () => void;
  export let onOpenSettings: () => void;
</script>

<section id="screen-home" class="screen-panel">
  <div class="home-panel">
    <div class="home-copy">
      <h1>mudshow</h1>
      <p>select a character to connect.</p>
    </div>

    <QuickConnectPanel
      worlds={worlds}
      characters={characters}
      onConnectWorld={onConnectWorld}
      onConnectCharacter={onConnectCharacter}
      onOpenWorldsAndCharacters={onOpenCharactersTab}
    />

    <div class="home-actions">
      <button type="button" class="btn" on:click={onOpenSettings}>
        ⚙ open app settings
      </button>
    </div>
  </div>
</section>
