<script lang="ts">
  import { invoke, isTauriAvailable } from '../../tauri';

  export let active = false;
  export let tabTitle = '';
  export let currentPath = '';
  export let defaultFolder = '';
  export let initialFileName = '';
  export let logError = '';
  export let refreshNonce = 0;

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

  $: fileName = active ? (currentPath.split(/[\\/]/).pop() || initialFileName) : initialFileName;

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

  $: if (calculatedFilePath) {
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

<div class="logging-modal host-modal-content">
  <p class="settings-note">
    {#if tabTitle}
      tab: {tabTitle} ·
    {/if}
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
          class="btn"
          title="Reveal the log file in its folder."
          aria-label="Reveal the log file in its folder."
          on:click={onRevealLog}
        >
          reveal log
        </button>
        <button
          type="button"
          class="btn warning"
          title="Rename the log file."
          aria-label="Rename the log file."
          disabled={!active}
          on:click={handleRenameLogging}
        >
          rename log
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
