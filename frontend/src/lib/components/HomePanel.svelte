<script lang="ts">
  export let onOpenCharacters: () => void;
  export let onOpenSettings: () => void;
  export let onOpenWorldSelector: () => void;
</script>

<section id="screen-home" class="screen-panel">
  <div class="home-panel">
    <div class="home-copy">
      <h1>mudshow</h1>
      <p>Open a tab to start a session, manage characters, or adjust app settings.</p>
    </div>

    <div class="home-actions">
      <button type="button" class="btn primary" on:click={onOpenWorldSelector}>
        connect to a world
      </button>
      <button type="button" class="btn" on:click={onOpenCharacters}>
        open characters
      </button>
      <button type="button" class="btn" on:click={onOpenSettings}>
        open app settings
      </button>
    </div>
  </div>
</section>
