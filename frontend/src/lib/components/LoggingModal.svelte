<script lang="ts">
  import { invoke, isTauriAvailable } from '../tauri';

  export let open = false;
  export let active = false;
  export let tabTitle = '';
  export let currentPath = '';
  export let defaultFolder = '';
  export let initialFileName = '';
  export let logError = '';
  export let refreshNonce = 0;

  export let onCancel: () => void;
  export let onStartLogging: (fileName: string) => void;
  export let onStopLogging: () => void;
  export let onRenameLogging: (fileName: string) => void;
  export let onRevealLog: () => void;
  export let onOpenLoggingSettings: () => void;

  let fileName = '';
  let calculatedFolderPath = '';
  let calculatedFilePath = '';
  let calculatedFileExists: boolean | null = null;
  let existenceCheckToken = 0;

  $: if (open) {
    fileName = active ? (currentPath.split(/[\\/]/).pop() || initialFileName) : initialFileName;
  }

  function getFolderPath(path: string): string {
    return path.replace(/[\\/][^\\/]*$/, '');
  }

  function joinPath(folder: string, name: string): string {
    const trimmedFolder = folder.replace(/[\\/]+$/, '');
    if (!trimmedFolder) {
      return name;
    }

    const separator = trimmedFolder.includes('\\') ? '\\' : '/';
    return `${trimmedFolder}${separator}${name}`;
  }

  function getDisplayFolderPath(): string {
    if (active && currentPath) {
      return getFolderPath(currentPath);
    }

    return defaultFolder;
  }

  $: calculatedFolderPath = getDisplayFolderPath();
  $: calculatedFilePath = active && currentPath
    ? currentPath
    : fileName.trim()
      ? joinPath(calculatedFolderPath, fileName.trim())
      : '';

  $: if (open && calculatedFilePath) {
    const token = ++existenceCheckToken;
    calculatedFileExists = null;
    const pathToCheck = calculatedFilePath;

    console.debug('[logging] file exists check', {
      path: pathToCheck,
      folder: calculatedFolderPath,
      fileName: fileName.trim(),
      currentPath,
      refreshNonce,
    });

    void (async () => {
      if (!isTauriAvailable()) {
        if (token === existenceCheckToken) {
          calculatedFileExists = null;
        }
        console.debug('[logging] file exists check unavailable', {
          path: pathToCheck,
          refreshNonce,
        });
        return;
      }

      try {
        const exists = await invoke<boolean>('path_exists', { path: pathToCheck });
        if (token === existenceCheckToken) {
          calculatedFileExists = exists;
        }
        console.debug('[logging] file exists check result', {
          path: pathToCheck,
          exists,
          refreshNonce,
        });
      } catch {
        if (token === existenceCheckToken) {
          calculatedFileExists = null;
        }
        console.debug('[logging] file exists check failed', {
          path: pathToCheck,
          refreshNonce,
        });
      }
    })();
  } else if (!open) {
    existenceCheckToken += 1;
    calculatedFileExists = null;
  } else {
    calculatedFileExists = null;
  }

  function handleStartLogging(): void {
    onStartLogging(fileName.trim());
  }

  function handleRenameLogging(): void {
    onRenameLogging(fileName.trim());
  }
</script>

{#if open}
  <div
    id="modal-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label="close logging modal"
    on:pointerdown|self={onCancel}
    on:keydown={(event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    }}
  >
    <div id="modal" class="logging-modal">
      <button
        type="button"
        class="btn logging-modal-close"
        aria-label="Close logging modal"
        title="Close logging modal"
        on:click={onCancel}
      >
        X
      </button>

      <h2>session logging</h2>
      {#if tabTitle}
        <p class="settings-note">tab: {tabTitle}</p>
      {/if}

      <p class="settings-note">
        status: {active ? 'logging active' : 'logging inactive'}
      </p>

      <label class="field storage-location-field">
        <span>path</span>
        <input
          type="text"
          value={calculatedFolderPath || defaultFolder}
          readonly
          disabled
          spellcheck="false"
        />
      </label>

      <label class="field storage-location-field">
        <span>file name</span>
        <div class="storage-location-row">
          <input
            id="logging-file-name"
            bind:value={fileName}
            autocomplete="off"
            spellcheck="false"
            placeholder="session-log.txt"
          />
          <div class="storage-location-actions">
            <button
              type="button"
              class="icon-button"
              title="Reveal the log file in its folder."
              aria-label="Reveal the log file in its folder."
              on:click={onRevealLog}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 8.5h6l1.8 2H20.5a1 1 0 0 1 1 1v6.5a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1Z" />
                <path d="M3.5 8.5V6.75a1 1 0 0 1 1-1H10l1.75 1.75H20a1 1 0 0 1 1 1V10" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-button warning"
              title="Rename the log file."
              aria-label="Rename the log file."
              disabled={!active}
              on:click={handleRenameLogging}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M7.5 4.5h7l4 4v11a1 1 0 0 1-1 1h-10a1 1 0 0 1-1-1v-14a1 1 0 0 1 1-1Z" />
                <path d="M14.5 4.5V9h4.5" />
                <path d="M8.5 13.5h7" />
                <path d="m11 11 2.5 2.5-2.5 2.5" />
              </svg>
            </button>
          </div>
        </div>
      </label>

      <p class="settings-note">
        file status: {
          active
            ? 'exists, appending now'
            : calculatedFilePath === ''
              ? 'no file name'
              : calculatedFileExists === null
                ? 'checking...'
                : calculatedFileExists
                  ? 'exists, will append'
                  : 'does not exist, new file'
        }
      </p>

      {#if logError}
        <p class="settings-note" style="color: var(--danger);">{logError}</p>
      {/if}

      <div class="modal-actions">
        <button class="btn primary" type="button" on:click={handleStartLogging} disabled={active}>
          start logging
        </button>
        <button class="btn danger" type="button" on:click={onStopLogging} disabled={!active}>
          stop logging
        </button>
        <button class="btn logging-modal-settings-button" type="button" on:click={onOpenLoggingSettings}>
          logging settings
        </button>
      </div>
    </div>
  </div>
{/if}
