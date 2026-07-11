<script lang="ts">
  import type { AppSettings } from '../app-settings';

  export let settings: AppSettings;
  export let onChange: (patch: Partial<AppSettings>) => void;
  export let storageFilePath: string | null;
  export let onRevealStorageLocation: () => void;
  export let onMoveStorageLocation: () => void;
</script>

<section id="screen-settings" class="screen-panel">
  <div class="settings-header">
    <div>
      <h1>app settings</h1>
      <p>global preferences for storage, notifications, and desktop behavior.</p>
    </div>
  </div>

  <div class="settings-grid">
    <section class="settings-card">
      <h2>database</h2>
      <div class="field">
        <label for="storage-mode">data storage</label>
        <select
          id="storage-mode"
          value={settings.storageMode}
          disabled
          on:change={() => onChange({ storageMode: 'file' })}
        >
          <option value="file">external json file</option>
        </select>
      </div>
      <label class="field storage-location-field">
        <span>storage file location</span>
        <div class="storage-location-row">
          <input
            type="text"
            value={storageFilePath ?? 'loading storage file location...'}
            disabled
            readonly
            spellcheck="false"
          />
          <div class="storage-location-actions">
            <button
              type="button"
              class="icon-button"
              title="Open the database folder and select the file."
              aria-label="Open the database folder and select the file."
              disabled={storageFilePath === null}
              on:click={onRevealStorageLocation}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 8.5h6l1.8 2H20.5a1 1 0 0 1 1 1v6.5a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1Z" />
                <path d="M3.5 8.5V6.75a1 1 0 0 1 1-1H10l1.75 1.75H20a1 1 0 0 1 1 1V10" />
              </svg>
            </button>
            <button
              type="button"
              class="icon-button danger"
              title="Move the database file to a new location."
              aria-label="Move the database file to a new location."
              disabled={storageFilePath === null}
              on:click={onMoveStorageLocation}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M3.5 8.5h6l1.8 2H20.5a1 1 0 0 1 1 1v6.5a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1Z" />
                <path d="M14 13.5h5" />
                <path d="m16.5 11 2.5 2.5-2.5 2.5" />
              </svg>
            </button>
          </div>
        </div>
      </label>
      <p class="settings-note">
        The current mode is saved locally and reused on startup.
      </p>
    </section>

    <section class="settings-card">
      <h2>activity notification</h2>
      <label class="settings-toggle">
        <input
          type="checkbox"
          checked={settings.titleAttention}
          on:change={(event) => onChange({ titleAttention: (event.currentTarget as HTMLInputElement).checked })}
        />
        <span>mark the window title when new activity arrives</span>
      </label>
    </section>

    <section class="settings-card">
      <h2>connections</h2>
      <div class="settings-stack">
        <label class="field disabled-field">
          <span>connection timeout (seconds)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={settings.connectionTimeoutSeconds}
            disabled
            on:input={(event) =>
              onChange({
                connectionTimeoutSeconds: Number((event.currentTarget as HTMLInputElement).value),
              })}
          />
        </label>

        <label class="field disabled-field">
          <span>connection retries</span>
          <input
            type="number"
            min="0"
            step="1"
            value={settings.connectionRetries}
            disabled
            on:input={(event) =>
              onChange({
                connectionRetries: Number((event.currentTarget as HTMLInputElement).value),
              })}
          />
        </label>

        <label class="settings-toggle disabled-field">
          <input
            type="checkbox"
            checked={settings.keepAlive}
            disabled
            on:change={(event) => onChange({ keepAlive: (event.currentTarget as HTMLInputElement).checked })}
          />
          <span>send tcp keepalives</span>
        </label>
      </div>
    </section>

    <section class="settings-card">
      <h2>spellcheck</h2>
      <label class="field disabled-field">
        <span>dictionary language</span>
        <input
          type="text"
          value={settings.spellcheckLanguage}
          disabled
          on:input={(event) =>
            onChange({
              spellcheckLanguage: (event.currentTarget as HTMLInputElement).value,
            })}
        />
      </label>
    </section>

    <section class="settings-card">
      <h2>ui</h2>
      <label class="field disabled-field">
        <span>color scheme</span>
        <select
          value={settings.colorScheme}
          disabled
          on:change={(event) =>
            onChange({ colorScheme: (event.currentTarget as HTMLSelectElement).value })}
        >
          <option value="midnight">midnight</option>
          <option value="graphite">graphite</option>
          <option value="amber">amber</option>
        </select>
      </label>
    </section>

    <section class="settings-card">
      <h2>window</h2>
      <div class="settings-stack">
        <label class="settings-toggle disabled-field">
          <input
            type="checkbox"
            checked={settings.alwaysOnTop}
            disabled
            on:change={(event) => onChange({ alwaysOnTop: (event.currentTarget as HTMLInputElement).checked })}
          />
          <span>keep the app on top</span>
        </label>

        <label class="field disabled-field">
          <span>transparency</span>
          <input
            type="range"
            min="60"
            max="100"
            step="1"
            value={settings.transparency}
            disabled
            on:input={(event) =>
              onChange({ transparency: Number((event.currentTarget as HTMLInputElement).value) })}
          />
        </label>
      </div>
    </section>
  </div>
</section>
