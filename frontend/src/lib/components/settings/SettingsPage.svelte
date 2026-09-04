<script lang="ts">
  import { appServices } from '../../app-services';
  import type { AppSettings } from '../../app-settings';
  import { session } from '../../session';
  import { DOCKVIEW_THEMES, normalizeDockviewThemeId } from '../../dockview-themes';
  import StyleSettingsPane from '../styles/StyleSettingsPane.svelte';
  import {
    SETTINGS_PAGE_PLACEHOLDER_TABS,
    SETTINGS_PAGE_TAB_ICONS,
    SETTINGS_PAGE_TABS,
    type SettingsTabId,
  } from './settings-page';
  import {
    DEFAULT_SQUIGGLE_COLOR,
    SQUIGGLE_PREVIEW_WAVY_PATH,
    SQUIGGLE_STYLE_OPTIONS,
    getSquiggleColorPickerValue,
    getSquigglePreviewDasharray,
    getSquigglePreviewDecorationStyle,
    normalizeHexColor,
    normalizeSquiggleStyle,
  } from '../../spellcheck-style';

  export let activeTab: SettingsTabId = 'database';
  export let onTabChange: (tab: SettingsTabId) => void = () => {};
  const appStyleScope = { kind: 'app' as const };
  const appStyleEditor = appServices.style.editor;
  const appFontShelf = appServices.style.fontShelf;
  let settings: AppSettings = appServices.settings.getSettings();

  appServices.settings.current.subscribe((next) => {
    settings = next;
  });

  let squiggleStyleMenuOpen = false;
  let dockviewThemeMenuOpen = false;
  $: currentSquiggleStyle = normalizeSquiggleStyle(settings.squiggleStyle);
  $: currentDockviewTheme = DOCKVIEW_THEMES.find((option) => option.id === settings.colorScheme) ?? DOCKVIEW_THEMES[0];

  function updateSettings(patch: Partial<AppSettings>): void {
    appServices.settings.updateSettings(patch);
  }

  async function handleRevealStorageLocation(): Promise<void> {
    try {
      await appServices.storage.revealAppStorageFile();
    } catch (error) {
      console.error('failed to reveal the storage location:', error);
    }
  }

  async function handleMoveStorageLocation(): Promise<void> {
    try {
      const nextPath = await appServices.storage.moveAppStorageFile();
      if (!nextPath) {
        return;
      }

      updateSettings({ storageFilePath: nextPath });
    } catch (error) {
      console.error('failed to move the storage location:', error);
    }
  }

  async function handleRevealLogFolder(): Promise<void> {
    try {
      const folder = appServices.storage.getResolvedDefaultLogFolder() ?? settings.defaultLogFolder ?? null;
      console.debug('[logging] revealing default log folder', folder);
      await appServices.storage.revealDefaultLogFolder(folder);
    } catch (error) {
      console.error('[logging] failed to reveal the log folder', error);
    }
  }

  async function handleMoveLogFolder(): Promise<void> {
    try {
      const nextFolder = await appServices.storage.moveDefaultLogFolder();
      if (!nextFolder) {
        return;
      }

      updateSettings({ defaultLogFolder: nextFolder });
    } catch (error) {
      console.error('failed to move the log folder:', error);
    }
  }

  async function handlePickStorageLocation(): Promise<void> {
    if ($session.tabs.some((tab) => tab.kind === 'world')) {
      await appServices.notice.alert({
        surfaceId: 'storage-import-notice',
        title: 'import blocked',
        message: 'Import settings file requires closing all world tabs and starting over, please close all tabs and try again.',
        confirmLabel: 'ok',
      });
      return;
    }

    try {
      const nextPath = await appServices.storage.pickAppStorageFile();
      if (!nextPath) {
        return;
      }

      const resolvedPath = await appServices.storage.setAppStoragePath(nextPath);
      updateSettings({ storageFilePath: resolvedPath });
      await session.load();
    } catch (error) {
      console.error('failed to pick the storage location:', error);
    }
  }
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
        {#each SETTINGS_PAGE_TABS as tab}
          <button
            type="button"
            class:active={activeTab === tab.id}
            class="settings-tab"
            on:click={() => onTabChange(tab.id)}
          >
            {@html SETTINGS_PAGE_TAB_ICONS[tab.id]}
            <span class:placeholder-tab-label={SETTINGS_PAGE_PLACEHOLDER_TABS.has(tab.id)}>{tab.label}</span>
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
              on:change={() => updateSettings({ storageMode: 'file' })}
            >
              <option value="file">external json file</option>
            </select>
          </div>
          <div class="field storage-location-field">
            <span>storage file location</span>
            <div class="storage-location-row">
              <input
                type="text"
                value={settings.storageFilePath ?? 'loading storage file location...'}
                disabled
                readonly
                spellcheck="false"
              />
              <div class="storage-location-actions">
                <button
                  type="button"
                  class="btn"
                  title="Open the database folder."
                  aria-label="Open the database folder."
                  disabled={settings.storageFilePath === null}
                  on:click={handleRevealStorageLocation}
                >
                  reveal file
                </button>
                <button
                  type="button"
                  class="btn warning"
                  title="Move the database file to a new location."
                  aria-label="Move the database file to a new location."
                  disabled={settings.storageFilePath === null}
                  on:click={handleMoveStorageLocation}
                >
                  move file
                </button>
                <button
                  type="button"
                  class="btn danger"
                  title="Pick a different database file. Discards the current file!"
                  aria-label="Pick a different database file. Discards the current file!"
                  disabled={settings.storageFilePath === null}
                  on:click={handlePickStorageLocation}
                >
                  pick different file
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
              on:change={(event) => updateSettings({ titleAttention: (event.currentTarget as HTMLInputElement).checked })}
            />
            <span>flash the window title when new activity arrives.</span>
          </label>
          <div class="settings-stack">
            <label class="settings-toggle disabled-field">
              <input
                type="checkbox"
                checked={settings.alwaysOnTop}
                disabled
                on:change={(event) => updateSettings({ alwaysOnTop: (event.currentTarget as HTMLInputElement).checked })}
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
                  updateSettings({ transparency: Number((event.currentTarget as HTMLInputElement).value) })}
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
                updateSettings({
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
                updateSettings({ linkImagePreviews: (event.currentTarget as HTMLInputElement).checked })}
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
                updateSettings({
                  transcriptScrollbackChunks: Math.max(1, Math.round(Number((event.currentTarget as HTMLInputElement).value))),
                })}
            />
          </label>
          <button
            type="button"
            class="btn"
            on:click={() =>
              updateSettings({
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
                value={appServices.storage.getResolvedDefaultLogFolder() ?? settings.defaultLogFolder ?? 'loading log folder...'}
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
                  on:click={handleRevealLogFolder}
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
                  on:click={handleMoveLogFolder}
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
          <label class="settings-toggle">
            <input
              type="checkbox"
              checked={settings.confirmUnloggedTabClose}
              on:change={(event) =>
                updateSettings({
                  confirmUnloggedTabClose: (event.currentTarget as HTMLInputElement).checked,
                })}
            />
            <span>confirm before closing a world tab that is not being logged.</span>
          </label>
          <p class="settings-note">
            when enabled, disconnected world tabs show the same kind of warning as connected tabs before they close.
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
                  updateSettings({
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
                  updateSettings({
                    connectionRetries: Number((event.currentTarget as HTMLInputElement).value),
                  })}
              />
            </label>

            <label class="settings-toggle disabled-field">
              <input
                type="checkbox"
                checked={settings.keepAlive}
                disabled
                on:change={(event) => updateSettings({ keepAlive: (event.currentTarget as HTMLInputElement).checked })}
              />
              <span>send tcp keep-alive signals.</span>
            </label>
          </div>
        </section>
      {:else if activeTab === 'spellcheck'}
        <section class="settings-card">
          <h2>spellcheck</h2>
          <label class="settings-toggle">
            <input
              type="checkbox"
              checked={settings.spellcheckEnabled}
              on:change={(event) =>
                updateSettings({ spellcheckEnabled: (event.currentTarget as HTMLInputElement).checked })}
            />
            <span>enable live spellcheck underlines in editable text fields.</span>
          </label>
          <div class="settings-stack">
            <div class="spellcheck-control-grid">
              <label class="field">
                <span>squiggle style</span>
                <div class="spellcheck-style-picker" data-open={squiggleStyleMenuOpen}>
                  <button
                    type="button"
                    class="spellcheck-style-picker-button"
                    aria-label={`spellcheck squiggle style ${currentSquiggleStyle}`}
                    aria-expanded={squiggleStyleMenuOpen}
                    on:click={() => (squiggleStyleMenuOpen = !squiggleStyleMenuOpen)}
                    on:keydown={(event) => {
                      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                        event.preventDefault();
                        squiggleStyleMenuOpen = true;
                      }
                    }}
                  >
                    <span
                      class="spellcheck-style-preview-swatch spellcheck-style-preview-swatch--button"
                      style:--spellcheck-preview-color={settings.squiggleColor}
                      style:--spellcheck-preview-opacity={settings.squiggleOpacity}
                      style:--spellcheck-preview-thickness={settings.squiggleSize}
                    >
                      <svg class="spellcheck-style-preview-svg" viewBox="0 0 120 24" aria-hidden="true">
                        {#if currentSquiggleStyle === 'wavy'}
                          <path d={SQUIGGLE_PREVIEW_WAVY_PATH} />
                        {:else}
                          <line
                            x1="4"
                            y1="13"
                            x2="116"
                            y2="13"
                            stroke-dasharray={getSquigglePreviewDasharray(currentSquiggleStyle) ?? undefined}
                          />
                        {/if}
                      </svg>
                    </span>
                    <span class="spellcheck-style-picker-caret" aria-hidden="true">▾</span>
                  </button>

                  {#if squiggleStyleMenuOpen}
                    <div class="spellcheck-style-menu" role="menu" aria-label="spellcheck squiggle style options">
                      {#each SQUIGGLE_STYLE_OPTIONS as option}
                        {@const optionPreviewStyle = getSquigglePreviewDecorationStyle(option.value)}
                        <button
                          type="button"
                          class="spellcheck-style-menu-item"
                          class:active={currentSquiggleStyle === option.value}
                          role="menuitemradio"
                          aria-checked={currentSquiggleStyle === option.value}
                          aria-label={`spellcheck squiggle style ${option.label}`}
                          title={option.label}
                          style:--spellcheck-preview-color={settings.squiggleColor}
                          style:--spellcheck-preview-opacity={settings.squiggleOpacity}
                          style:--spellcheck-preview-thickness={settings.squiggleSize}
                          on:click={() => {
                            updateSettings({ squiggleStyle: option.value });
                            squiggleStyleMenuOpen = false;
                          }}
                        >
                          <span class="spellcheck-style-preview-swatch spellcheck-style-preview-swatch--menu">
                            <svg class="spellcheck-style-preview-svg" viewBox="0 0 120 24" aria-hidden="true">
                              {#if optionPreviewStyle === 'wavy'}
                                <path d={SQUIGGLE_PREVIEW_WAVY_PATH} />
                              {:else}
                                <line
                                  x1="4"
                                  y1="13"
                                  x2="116"
                                  y2="13"
                                  stroke-dasharray={getSquigglePreviewDasharray(optionPreviewStyle) ?? undefined}
                                />
                              {/if}
                            </svg>
                          </span>
                          <span class="spellcheck-style-menu-label">{option.label}</span>
                        </button>
                      {/each}
                    </div>
                  {/if}
                </div>
              </label>

              <label class="field">
                <span>squiggle color</span>
                <div class="spellcheck-color-row">
                  <label class="spellcheck-color-picker" aria-label="spellcheck squiggle color picker">
                    <input
                      type="color"
                      value={getSquiggleColorPickerValue(settings.squiggleColor)}
                      aria-label="spellcheck squiggle color picker"
                      on:input={(event) =>
                        updateSettings({
                          squiggleColor:
                            normalizeHexColor((event.currentTarget as HTMLInputElement).value) ??
                            (event.currentTarget as HTMLInputElement).value,
                        })}
                    />
                  </label>
                  <input
                    class="spellcheck-color-input"
                    type="text"
                    value={settings.squiggleColor}
                    spellcheck="false"
                    aria-label="spellcheck squiggle color"
                    on:input={(event) =>
                      updateSettings({
                        squiggleColor: (event.currentTarget as HTMLInputElement).value,
                      })}
                    on:paste={(event) => {
                      const pastedText = event.clipboardData?.getData('text') ?? '';
                      const normalizedText = normalizeHexColor(pastedText);

                      if (normalizedText !== null) {
                        event.preventDefault();
                        updateSettings({ squiggleColor: normalizedText });
                      }
                    }}
                  />
                </div>
              </label>

              <label class="field">
                <span>squiggle opacity</span>
                <div class="spellcheck-opacity-row">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.squiggleOpacity}
                    aria-label="spellcheck squiggle opacity"
                    on:input={(event) =>
                      updateSettings({
                        squiggleOpacity: Math.min(
                          1,
                          Math.max(0, Number((event.currentTarget as HTMLInputElement).value)),
                        ),
                      })}
                  />
                  <input
                    class="spellcheck-opacity-input"
                    type="number"
                    min="0"
                    max="1"
                    step="0.01"
                    value={settings.squiggleOpacity}
                    aria-label="spellcheck squiggle opacity value"
                    on:input={(event) =>
                      updateSettings({
                        squiggleOpacity: Math.min(
                          1,
                          Math.max(0, Number((event.currentTarget as HTMLInputElement).value)),
                        ),
                      })}
                  />
                </div>
              </label>

              <label class="field">
                <span>squiggle thickness</span>
                <div class="spellcheck-size-row">
                  <input
                    type="range"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={settings.squiggleSize}
                    aria-label="spellcheck squiggle thickness"
                    on:input={(event) =>
                      updateSettings({
                        squiggleSize: Math.min(
                          4,
                          Math.max(0.5, Number((event.currentTarget as HTMLInputElement).value)),
                        ),
                      })}
                  />
                  <input
                    class="spellcheck-size-input"
                    type="number"
                    min="0.5"
                    max="4"
                    step="0.1"
                    value={settings.squiggleSize}
                    aria-label="spellcheck squiggle thickness value"
                    on:input={(event) =>
                      updateSettings({
                        squiggleSize: Math.min(
                          4,
                          Math.max(0.5, Number((event.currentTarget as HTMLInputElement).value)),
                        ),
                      })}
                  />
                </div>
              </label>

              <label class="field">
                <span>suggestion limit</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={settings.spellcheckSuggestionLimit}
                  on:input={(event) =>
                    updateSettings({
                      spellcheckSuggestionLimit: Math.max(
                        1,
                        Math.round(Number((event.currentTarget as HTMLInputElement).value)),
                      ),
                    })}
                />
              </label>

              <label class="field">
                <span>minimum word length</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={settings.spellcheckMinimumWordLength}
                  on:input={(event) =>
                    updateSettings({
                      spellcheckMinimumWordLength: Math.max(
                        1,
                        Math.round(Number((event.currentTarget as HTMLInputElement).value)),
                      ),
                    })}
                />
              </label>

              <label class="field">
                <span>typing debounce (ms)</span>
                <input
                  type="number"
                  min="0"
                  step="25"
                  value={settings.spellcheckDebounceMs}
                  on:input={(event) =>
                    updateSettings({
                      spellcheckDebounceMs: Math.max(
                        0,
                        Math.round(Number((event.currentTarget as HTMLInputElement).value)),
                      ),
                    })}
                />
              </label>

              <label class="field">
                <span>queue concurrency</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={settings.spellcheckQueueConcurrency}
                  on:input={(event) =>
                    updateSettings({
                      spellcheckQueueConcurrency: Math.max(
                        1,
                        Math.round(Number((event.currentTarget as HTMLInputElement).value)),
                      ),
                    })}
                />
              </label>
            </div>

            <div class="spellcheck-full-width-fields">
              <label class="field">
                <span>dictionary language or locale hint</span>
                <input
                  type="text"
                  value={settings.spellcheckLanguage}
                  spellcheck="false"
                  on:input={(event) =>
                    updateSettings({
                      spellcheckLanguage: (event.currentTarget as HTMLInputElement).value,
                    })}
              />
              </label>

              <label class="field">
                <span>ignored words, comma separated</span>
                <input
                  type="text"
                  value={settings.spellcheckIgnoredWords}
                  spellcheck="false"
                  on:input={(event) =>
                    updateSettings({
                      spellcheckIgnoredWords: (event.currentTarget as HTMLInputElement).value,
                    })}
              />
              </label>
            </div>
          </div>
          <p class="settings-note">
            the input context menu stays available even when spellcheck is off, and right-click suggestions use the Rust spell engine with your saved ignore words.
          </p>
        </section>
      {:else if activeTab === 'style'}
        <StyleSettingsPane
          storageScope={appStyleScope}
          style={$appStyleEditor}
          fontShelf={$appFontShelf}
          onChange={appServices.style.saveStyle}
          onFontShelfChange={appServices.style.updateFontShelf}
        />
      {:else if activeTab === 'ui'}
        <section class="settings-card">
          <h2>ui</h2>
          <label class="field">
            <span>dockview theme</span>
            <div class="dockview-theme-picker" data-open={dockviewThemeMenuOpen}>
              <button
                type="button"
                class="dockview-theme-picker-button"
                aria-label={`dockview theme ${currentDockviewTheme.label}`}
                aria-expanded={dockviewThemeMenuOpen}
                on:click={() => (dockviewThemeMenuOpen = !dockviewThemeMenuOpen)}
                on:keydown={(event) => {
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                    event.preventDefault();
                    dockviewThemeMenuOpen = true;
                  }
                }}
              >
                <span
                  class="dockview-theme-preview dockview-theme-preview--button"
                  style:--dockview-preview-surface={currentDockviewTheme.preview.surface}
                  style:--dockview-preview-tab={currentDockviewTheme.preview.tab}
                  style:--dockview-preview-active={currentDockviewTheme.preview.active}
                  style:--dockview-preview-accent={currentDockviewTheme.preview.accent}
                  style:--dockview-preview-foreground={currentDockviewTheme.preview.foreground}
                  aria-hidden="true"
                >
                  <span class="dockview-theme-preview-tab dockview-theme-preview-tab--inactive">a</span>
                  <span class="dockview-theme-preview-tab dockview-theme-preview-tab--active">b</span>
                  <span class="dockview-theme-preview-panel">· · ·</span>
                </span>
                <span class="dockview-theme-picker-label">{currentDockviewTheme.label}</span>
                <span class="spellcheck-style-picker-caret" aria-hidden="true">▾</span>
              </button>

              {#if dockviewThemeMenuOpen}
                <div class="dockview-theme-menu" role="menu" aria-label="Dockview theme options">
                  {#each DOCKVIEW_THEMES as option}
                    <button
                      type="button"
                      class="dockview-theme-menu-item"
                      class:active={currentDockviewTheme.id === option.id}
                      role="menuitemradio"
                      aria-checked={currentDockviewTheme.id === option.id}
                      aria-label={`Dockview theme ${option.label}`}
                      title={option.label}
                      on:click={() => {
                        updateSettings({ colorScheme: normalizeDockviewThemeId(option.id) });
                        dockviewThemeMenuOpen = false;
                      }}
                    >
                      <span
                        class="dockview-theme-preview dockview-theme-preview--menu"
                        style:--dockview-preview-surface={option.preview.surface}
                        style:--dockview-preview-tab={option.preview.tab}
                        style:--dockview-preview-active={option.preview.active}
                        style:--dockview-preview-accent={option.preview.accent}
                        style:--dockview-preview-foreground={option.preview.foreground}
                        aria-hidden="true"
                      >
                        <span class="dockview-theme-preview-tab dockview-theme-preview-tab--inactive">a</span>
                        <span class="dockview-theme-preview-tab dockview-theme-preview-tab--active">b</span>
                        <span class="dockview-theme-preview-panel">· · ·</span>
                      </span>
                      <span class="dockview-theme-menu-label">{option.label}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          </label>
        </section>
      {/if}
    </div>
  </div>
</section>
