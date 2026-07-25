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
  const DEFAULT_SQUIGGLE_COLOR = '#ff0000';
  const SQUIGGLE_PREVIEW_WAVY_PATH =
    'M 4 13 C 7 6, 11 6, 14 13 S 21 20, 24 13 S 31 6, 34 13 S 41 20, 44 13 S 51 6, 54 13 S 61 20, 64 13 S 71 6, 74 13 S 81 20, 84 13 S 91 6, 94 13 S 101 20, 104 13 S 111 6, 114 13';
  const SQUIGGLE_STYLE_OPTIONS = [
    { value: 'wavy', label: 'wavy' },
    { value: 'dashed', label: 'dashes' },
    { value: 'dotted', label: 'dots' },
    { value: 'solid', label: 'solid' },
  ];

  let squiggleStyleMenuOpen = false;
  let squiggleStylePickerElement: HTMLDivElement | null = null;
  const placeholderTabs = new Set<SettingsTabId>(['connections', 'ui']);

  function isHexColor(input: string): boolean {
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(input.trim());
  }

  function normalizeHexColor(input: string): string | null {
    const trimmed = input.trim();
    const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);

    if (!match) {
      return null;
    }

    const hex = match[1].toLowerCase();
    if (hex.length === 3) {
      return `#${hex
        .split('')
        .map((character) => character + character)
        .join('')}`;
    }

    return `#${hex}`;
  }

  function getSquiggleColorPickerValue(value: string): string {
    const currentValue = value.trim();
    if (isHexColor(currentValue)) {
      return currentValue.toLowerCase();
    }

    return DEFAULT_SQUIGGLE_COLOR;
  }

  function normalizeSquiggleStyle(value: string): string {
    const trimmed = value.trim().toLowerCase();
    if (trimmed === 'zigzag') {
      return 'wavy';
    }

    return SQUIGGLE_STYLE_OPTIONS.some((option) => option.value === trimmed)
      ? trimmed
      : 'wavy';
  }

  function isSelectedSquiggleStyle(value: string): boolean {
    return normalizeSquiggleStyle(settings.squiggleStyle) === value;
  }

  function getSquigglePreviewDecorationStyle(value: string): string {
    switch (value) {
      case 'dashed':
      case 'dotted':
      case 'solid':
      case 'wavy':
        return value;
      default:
        return 'wavy';
    }
  }

  function getSquigglePreviewDasharray(value: string): string | null {
    switch (value) {
      case 'dashed':
        return '12 7';
      case 'dotted':
        return '1 6';
      case 'solid':
        return null;
      default:
        return null;
    }
  }

  function openSquiggleStyleMenu(): void {
    squiggleStyleMenuOpen = true;
  }

  function closeSquiggleStyleMenu(): void {
    squiggleStyleMenuOpen = false;
  }

  function toggleSquiggleStyleMenu(): void {
    squiggleStyleMenuOpen = !squiggleStyleMenuOpen;
  }

  function selectSquiggleStyle(value: string): void {
    onChange({ squiggleStyle: value });
    closeSquiggleStyleMenu();
  }

  function handleSquiggleStyleButtonKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      openSquiggleStyleMenu();
    }
  }

  function handleWindowPointerDown(event: PointerEvent): void {
    if (!squiggleStyleMenuOpen) {
      return;
    }

    const target = event.target as Node | null;
    if (target === null || squiggleStylePickerElement === null) {
      closeSquiggleStyleMenu();
      return;
    }

    if (!squiggleStylePickerElement.contains(target)) {
      closeSquiggleStyleMenu();
    }
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && squiggleStyleMenuOpen) {
      event.preventDefault();
      closeSquiggleStyleMenu();
    }
  }

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
            <span class:placeholder-tab-label={placeholderTabs.has(tab.id)}>{tab.label}</span>
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
          <label class="settings-toggle">
            <input
              type="checkbox"
              checked={settings.confirmUnloggedTabClose}
              on:change={(event) =>
                onChange({
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
          <label class="settings-toggle">
            <input
              type="checkbox"
              checked={settings.spellcheckEnabled}
              on:change={(event) =>
                onChange({ spellcheckEnabled: (event.currentTarget as HTMLInputElement).checked })}
            />
            <span>enable live spellcheck underlines in editable text fields.</span>
          </label>
          <div class="settings-stack">
            <div class="spellcheck-control-grid">
              <label class="field">
                <span>squiggle style</span>
                <div
                  bind:this={squiggleStylePickerElement}
                  class="spellcheck-style-picker"
                  data-open={squiggleStyleMenuOpen}
                >
                  <button
                    type="button"
                    class="spellcheck-style-picker-button"
                    aria-label={`spellcheck squiggle style ${normalizeSquiggleStyle(settings.squiggleStyle)}`}
                    aria-expanded={squiggleStyleMenuOpen}
                    on:click={toggleSquiggleStyleMenu}
                    on:keydown={handleSquiggleStyleButtonKeydown}
                  >
                    <span
                      class="spellcheck-style-preview-swatch spellcheck-style-preview-swatch--button"
                      style:--spellcheck-preview-color={settings.squiggleColor}
                      style:--spellcheck-preview-opacity={settings.squiggleOpacity}
                      style:--spellcheck-preview-thickness={settings.squiggleSize}
                    >
                      <svg class="spellcheck-style-preview-svg" viewBox="0 0 120 24" aria-hidden="true">
                        {#if normalizeSquiggleStyle(settings.squiggleStyle) === 'wavy'}
                          <path d={SQUIGGLE_PREVIEW_WAVY_PATH} />
                        {:else}
                          <line
                            x1="4"
                            y1="13"
                            x2="116"
                            y2="13"
                            stroke-dasharray={getSquigglePreviewDasharray(normalizeSquiggleStyle(settings.squiggleStyle)) ?? undefined}
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
                          class:active={isSelectedSquiggleStyle(option.value)}
                          role="menuitemradio"
                          aria-checked={isSelectedSquiggleStyle(option.value)}
                          aria-label={`spellcheck squiggle style ${option.label}`}
                          title={option.label}
                          style:--spellcheck-preview-color={settings.squiggleColor}
                          style:--spellcheck-preview-opacity={settings.squiggleOpacity}
                          style:--spellcheck-preview-thickness={settings.squiggleSize}
                          on:click={() => selectSquiggleStyle(option.value)}
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
                        onChange({
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
                      onChange({
                        squiggleColor: (event.currentTarget as HTMLInputElement).value,
                      })}
                    on:paste={(event) => {
                      const pastedText = event.clipboardData?.getData('text') ?? '';
                      const normalizedText = normalizeHexColor(pastedText);

                      if (normalizedText !== null) {
                        event.preventDefault();
                        onChange({ squiggleColor: normalizedText });
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
                      onChange({
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
                      onChange({
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
                      onChange({
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
                      onChange({
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
                    onChange({
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
                    onChange({
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
                    onChange({
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
                    onChange({
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
                    onChange({
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
                    onChange({
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
