<script lang="ts">
  import type { AppSettings } from '../../app-settings';
  import type { FontShelfEntry } from '../../fonts';
  import type { AppStyleEditor } from '../styles/style-settings';
  import StyleSettingsPane from '../styles/StyleSettingsPane.svelte';

  export type SettingsTabId =
    | 'database'
    | 'window'
    | 'transcript'
    | 'logging'
    | 'connections'
    | 'spellcheck'
    | 'style'
    | 'ui';

  export let settings: AppSettings;
  export let onChange: (patch: Partial<AppSettings>) => void;
  export let style: AppStyleEditor;
  export let onStyleChange: (next: AppStyleEditor) => void;
  export let fontShelf: FontShelfEntry[];
  export let onFontShelfChange: (next: FontShelfEntry[]) => void;
  export let storageFilePath: string | null;
  export let resolvedLogFolderPath: string | null;
  export let onRevealLogFolder: () => void;
  export let onMoveLogFolder: () => void;
  export let onRevealStorageLocation: () => void;
  export let onPickStorageLocation: () => void;
  export let onMoveStorageLocation: () => void;
  export let activeTab: SettingsTabId = 'database';
  export let onTabChange: (tab: SettingsTabId) => void = () => {};
  const appStyleScope = { kind: 'app' as const };

  const tabIcons: Record<SettingsTabId, string> = {
    database: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 7.5c0 1.66 4.03 3 9 3s9-1.34 9-3-4.03-3-9-3-9 1.34-9 3Z"/><path d="M4.5 7.5v9c0 1.66 4.03 3 9 3s9-1.34 9-3v-9"/><path d="M4.5 12c0 1.66 4.03 3 9 3s9-1.34 9-3"/></svg>`,
    window: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="5" width="15" height="14" rx="2"/><path d="M4.5 9h15"/><path d="M8 5v14"/></svg>`,
    transcript: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 5.5h12"/><path d="M6 10h12"/><path d="M6 14.5h8"/><path d="M6 19h12"/><path d="M4.5 4.5v15h15"/></svg>`,
    logging: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 5.5h11l2 3v10a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1Z"/><path d="M8 12h8"/><path d="M8 15.5h5"/></svg>`,
    connections: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 14.5a4 4 0 0 1 6.7-2.9"/><path d="M4.5 12a7.5 7.5 0 0 1 12.6-5.5"/><path d="M15.5 12a3.5 3.5 0 0 1 5.5 2.8"/><path d="M11 17.5h2"/><path d="M12 17.5v3"/></svg>`,
    spellcheck: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 6.5h6"/><path d="M5 11h4"/><path d="M5 15.5h8"/><path d="M14.5 7.5l2.25 2.75L21 5.75"/><path d="M15 16l2.5 2.5 4-4"/></svg>`,
    style: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4.5c4.4 0 8 3.1 8 7 0 2.2-1.1 4.2-3 5.5V20l-3.5-2h-1.5c-4.4 0-8-3.1-8-7s3.6-7.5 8-7.5Z"/><path d="M9 11.5h6"/><path d="M12 8.5v6"/></svg>`,
    ui: `<svg class="settings-tab-icon" viewBox="0 0 24 24" aria-hidden="true"><rect x="4.5" y="4.5" width="15" height="15" rx="2"/><path d="M8 8h8"/><path d="M8 12h5"/><path d="M8 16h3"/></svg>`,
  };

  const tabs: Array<{ id: SettingsTabId; label: string }> = [
    { id: 'database', label: 'Database' },
    { id: 'window', label: 'Window' },
    { id: 'transcript', label: 'Transcript' },
    { id: 'logging', label: 'Logging' },
    { id: 'connections', label: 'Connections' },
    { id: 'spellcheck', label: 'Spellcheck' },
    { id: 'style', label: 'Default Style' },
    { id: 'ui', label: 'UI' },
  ];
</script>

<section id="screen-settings" class="screen-panel">
  <div class="settings-shell">
    <aside class="settings-sidebar" aria-label="App settings sections">
      <div class="settings-header">
        <div>
          <h1>app settings</h1>
        </div>
      </div>

      <nav class="settings-tab-list">
        {#each tabs as tab}
          <button
            type="button"
            class:active={activeTab === tab.id}
            class="settings-tab"
            on:click={() => onTabChange(tab.id)}
          >
            {@html tabIcons[tab.id]}
            <span>{tab.label}</span>
          </button>
        {/each}
      </nav>
    </aside>

    <div class="settings-pane">
      {#if activeTab === 'database'}
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
          <div class="field storage-location-field">
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
                  title="Open the database folder."
                  aria-label="Open the database folder."
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
                  class="icon-button warning"
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
                <button
                  type="button"
                  class="icon-button danger"
                  title="Pick a different database file. Discards the current file!"
                  aria-label="Pick a different database file. Discards the current file!"
                  disabled={storageFilePath === null}
                  on:click={onPickStorageLocation}
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
          </div>
          <p class="settings-note">
            database file location is saved in the app itself. if the app forgets the location, use the pick button to locate the correct file.
          </p>
        </section>
      {:else if activeTab === 'window'}
        <section class="settings-card">
          <h2>window</h2>
          <p>crossed out settings do not work yet.</p>
          <label class="settings-toggle">
            <input
              type="checkbox"
              checked={settings.titleAttention}
              on:change={(event) => onChange({ titleAttention: (event.currentTarget as HTMLInputElement).checked })}
            />
            <span>flash the window title when new activity arrives.</span>
          </label>
          <div class="settings-stack">
            <label class="settings-toggle disabled-field">
              <input
                type="checkbox"
                checked={settings.alwaysOnTop}
                disabled
                on:change={(event) => onChange({ alwaysOnTop: (event.currentTarget as HTMLInputElement).checked })}
              />
              <span>keep the app window on-top of others.</span>
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
      {:else if activeTab === 'transcript'}
        <section class="settings-card">
          <h2>transcript</h2>
          <label class="settings-toggle">
            <input
              type="checkbox"
              checked={settings.showCurrentOutputWhenScrollingUp}
              on:change={(event) =>
                onChange({
                  showCurrentOutputWhenScrollingUp: (event.currentTarget as HTMLInputElement).checked,
                })}
            />
            <span>keep current output in view while scrolling.</span>
          </label>
          <label class="settings-toggle">
            <input
              type="checkbox"
              checked={settings.linkImagePreviews}
              on:change={(event) =>
                onChange({ linkImagePreviews: (event.currentTarget as HTMLInputElement).checked })}
            />
            <span>show previews for image links.</span>
          </label>
          <label class="field">
            <span>scrollback chunks</span>
            <input
              type="number"
              min="1"
              step="100"
              value={settings.transcriptScrollbackChunks}
              on:input={(event) =>
                onChange({
                  transcriptScrollbackChunks: Math.max(1, Math.round(Number((event.currentTarget as HTMLInputElement).value))),
                })}
            />
          </label>
          <button
            type="button"
            class="btn"
            on:click={() =>
              onChange({
                imagePreviewCacheVersion: settings.imagePreviewCacheVersion + 1,
              })}
          >
            refresh image previews
          </button>
          <p class="settings-note">
            Cache-bust loaded preview images for testing.
          </p>
        </section>
      {:else if activeTab === 'logging'}
        <section class="settings-card">
          <h2>logging</h2>
          <div class="field storage-location-field">
            <span>default log folder</span>
            <div class="storage-location-row">
              <input
                type="text"
                value={resolvedLogFolderPath ?? settings.defaultLogFolder ?? 'loading log folder...'}
                spellcheck="false"
                readonly
                disabled
              />
              <div class="storage-location-actions">
                <button
                  type="button"
                  class="icon-button"
                  title="Open the default log folder."
                  aria-label="Open the default log folder."
                  on:click={onRevealLogFolder}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3.5 8.5h6l1.8 2H20.5a1 1 0 0 1 1 1v6.5a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1Z" />
                    <path d="M3.5 8.5V6.75a1 1 0 0 1 1-1H10l1.75 1.75H20a1 1 0 0 1 1 1V10" />
                  </svg>
                </button>
                <button
                  type="button"
                  class="icon-button warning"
                  title="Move the default log folder to a new location. Will not move logs."
                  aria-label="Move the default log folder to a new location. Will not move logs."
                  on:click={onMoveLogFolder}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M3.5 8.5h6l1.8 2H20.5a1 1 0 0 1 1 1v6.5a2 2 0 0 1-2 2h-14a2 2 0 0 1-2-2V9.5a1 1 0 0 1 1-1Z" />
                    <path d="M14 13.5h5" />
                    <path d="m16.5 11 2.5 2.5-2.5 2.5" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
          <p class="settings-note">
            new session logs start here.
          </p>
        </section>
      {:else if activeTab === 'connections'}
        <section class="settings-card">
          <h2>connections</h2>
          <p>crossed out settings do not work yet.</p>
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
              <span>send tcp keep-alive signals.</span>
            </label>
          </div>
        </section>
      {:else if activeTab === 'spellcheck'}
        <section class="settings-card">
          <h2>spellcheck</h2>
          <p>crossed out settings do not work yet.</p>
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
      {:else if activeTab === 'style'}
        <StyleSettingsPane
          storageScope={appStyleScope}
          style={style}
          fontShelf={fontShelf}
          onChange={onStyleChange}
          onFontShelfChange={onFontShelfChange}
        />
      {:else if activeTab === 'ui'}
        <section class="settings-card">
          <h2>ui</h2>
          <p>crossed out settings do not work yet.</p>
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
      {/if}
    </div>
  </div>
</section>
