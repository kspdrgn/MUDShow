<script lang="ts">
  export let open = false;
  export let active = false;
  export let tabTitle = '';
  export let currentPath = '';
  export let defaultFolder = '';
  export let initialFileName = '';
  export let logError = '';

  export let onCancel: () => void;
  export let onQuickLog: () => void;
  export let onStartLogging: (fileName: string) => void;
  export let onStopLogging: () => void;
  export let onRenameLogging: (fileName: string) => void;
  export let onRevealLog: () => void;

  let fileName = '';

  $: if (open) {
    fileName = active ? (currentPath.split(/[\\/]/).pop() || initialFileName) : initialFileName;
  }

  function handlePrimaryAction(): void {
    const nextName = fileName.trim();

    if (active) {
      onRenameLogging(nextName);
      return;
    }

    onStartLogging(nextName);
  }
</script>

{#if open}
  <div
    id="modal-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label="close logging modal"
    on:click|self={onCancel}
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }}
  >
    <div id="modal" class="logging-modal">
      <h2>session logging</h2>
      {#if tabTitle}
        <p class="settings-note">tab: {tabTitle}</p>
      {/if}

      {#if active}
        <p class="settings-note">logging is active.</p>
        <p class="settings-note">
          current file: {currentPath || 'creating log file...'}
        </p>
      {:else}
        <p class="settings-note">
          logging will start in the configured default folder unless you change the file name.
        </p>
        <p class="settings-note">
          default folder: {defaultFolder || 'using a safe fallback folder'}
        </p>
      {/if}

      <form on:submit|preventDefault={handlePrimaryAction}>
        <div class="field">
          <label for="logging-file-name">file name</label>
          <input
            id="logging-file-name"
            bind:value={fileName}
            autocomplete="off"
            spellcheck="false"
            placeholder="session-log.txt"
          />
        </div>

        {#if logError}
          <p class="settings-note" style="color: var(--danger);">{logError}</p>
        {/if}

        <div class="modal-actions">
          <button class="btn" type="button" on:click={onCancel}>cancel</button>
          {#if active}
            <button class="btn" type="button" on:click={onRevealLog} disabled={!currentPath}>
              reveal
            </button>
            <button class="btn" type="button" on:click={onStopLogging}>stop</button>
            <button class="btn primary" type="submit">rename file</button>
          {:else}
            <button class="btn" type="button" on:click={onQuickLog}>quick log</button>
            <button class="btn primary" type="submit">start logging</button>
          {/if}
        </div>
      </form>
    </div>
  </div>
{/if}
