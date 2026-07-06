<script lang="ts">
  import type { AppSettings } from '../app-settings';

  export let settings: AppSettings;
  export let onChange: (patch: Partial<AppSettings>) => void;
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
          on:change={(event) =>
            onChange({
              storageMode: (event.currentTarget as HTMLSelectElement).value === 'file'
                ? 'file'
                : 'webview',
            })}
        >
          <option value="webview">webview profile</option>
          <option value="file">external json file</option>
        </select>
      </div>
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
        <label class="field">
          <span>connection timeout (seconds)</span>
          <input
            type="number"
            min="1"
            step="1"
            value={settings.connectionTimeoutSeconds}
            on:input={(event) =>
              onChange({
                connectionTimeoutSeconds: Number((event.currentTarget as HTMLInputElement).value),
              })}
          />
        </label>

        <label class="field">
          <span>connection retries</span>
          <input
            type="number"
            min="0"
            step="1"
            value={settings.connectionRetries}
            on:input={(event) =>
              onChange({
                connectionRetries: Number((event.currentTarget as HTMLInputElement).value),
              })}
          />
        </label>

        <label class="settings-toggle">
          <input
            type="checkbox"
            checked={settings.keepAlive}
            on:change={(event) => onChange({ keepAlive: (event.currentTarget as HTMLInputElement).checked })}
          />
          <span>send tcp keepalives</span>
        </label>
      </div>
    </section>

    <section class="settings-card">
      <h2>spellcheck</h2>
      <label class="field">
        <span>dictionary language</span>
        <input
          type="text"
          value={settings.spellcheckLanguage}
          on:input={(event) =>
            onChange({
              spellcheckLanguage: (event.currentTarget as HTMLInputElement).value,
            })}
        />
      </label>
    </section>

    <section class="settings-card">
      <h2>ui</h2>
      <label class="field">
        <span>color scheme</span>
        <select
          value={settings.colorScheme}
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
        <label class="settings-toggle">
          <input
            type="checkbox"
            checked={settings.alwaysOnTop}
            on:change={(event) => onChange({ alwaysOnTop: (event.currentTarget as HTMLInputElement).checked })}
          />
          <span>keep the app on top</span>
        </label>

        <label class="field">
          <span>transparency</span>
          <input
            type="range"
            min="60"
            max="100"
            step="1"
            value={settings.transparency}
            on:input={(event) =>
              onChange({ transparency: Number((event.currentTarget as HTMLInputElement).value) })}
          />
        </label>
      </div>
    </section>
  </div>
</section>
