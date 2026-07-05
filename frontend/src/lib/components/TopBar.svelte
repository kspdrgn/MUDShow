<script lang="ts">
  import { isTauriAvailable, invoke } from '../tauri';

  export let onOpenWorldSelector: () => void;

  const tabs = [
    { id: 'world-one', label: 'World One', active: true },
    { id: 'world-two', label: 'World Two', active: false },
  ];

  async function minimizeWindow(): Promise<void> {
    if (!isTauriAvailable()) {
      return;
    }

    await invoke('window_minimize');
  }

  async function toggleMaximizeWindow(): Promise<void> {
    if (!isTauriAvailable()) {
      return;
    }

    await invoke('window_toggle_maximize');
  }

  async function closeWindow(): Promise<void> {
    if (!isTauriAvailable()) {
      return;
    }

    await invoke('window_close');
  }
</script>

<header id="titlebar" data-tauri-drag-region>
  <div id="titlebar-brand" aria-hidden="true">
    <span class="titlebar-app-name">MUDShow</span>
  </div>

  <div id="titlebar-tabs">
    <div class="world-tabs" aria-label="world tabs">
      {#each tabs as tab}
        <button
          type="button"
          class:active={tab.active}
          class="world-tab"
          title={tab.label}
          aria-label={tab.label}
        >
          {tab.label}
        </button>
      {/each}

      <button
        type="button"
        class="world-tab world-tab-add"
        title="open connection selector"
        aria-label="open connection selector"
        on:click={onOpenWorldSelector}
      >
        +
      </button>
    </div>
  </div>

  <div id="titlebar-actions">
    <button
      type="button"
      class="titlebar-button titlebar-menu-button"
      title="app menu coming soon"
      aria-label="app menu coming soon"
    >
      ☰
    </button>

    <div class="window-controls" aria-label="window controls">
      <button
        type="button"
        class="titlebar-button window-button"
        title="minimize window"
        aria-label="minimize window"
        on:click={minimizeWindow}
      >
        -
      </button>
      <button
        type="button"
        class="titlebar-button window-button"
        title="maximize window"
        aria-label="maximize window"
        on:click={toggleMaximizeWindow}
      >
        □
      </button>
      <button
        type="button"
        class="titlebar-button window-button close"
        title="close window"
        aria-label="close window"
        on:click={closeWindow}
      >
        ×
      </button>
    </div>
  </div>
</header>
