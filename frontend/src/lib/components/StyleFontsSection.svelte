<script lang="ts">
  import { type StyleSectionScope } from './style-settings';
  import StyleSlideToggle from './StyleSlideToggle.svelte';

  export let sectionScope: StyleSectionScope;

  const DEFAULT_FONT_FAMILY = 'inherit';
  const DEFAULT_FONT_SIZE = 16;

  let fontSelectionOverrideEnabled = false;
  let fontSizeOverrideEnabled = false;
  let fontFamily = DEFAULT_FONT_FAMILY;
  let fontSize = DEFAULT_FONT_SIZE;

  function normalizeFamily(value: string): string {
    return value.trim().toLowerCase();
  }

  function updateFontFamily(nextValue: string): void {
    fontFamily = nextValue;
    if (normalizeFamily(fontFamily) === normalizeFamily(DEFAULT_FONT_FAMILY)) {
      fontSelectionOverrideEnabled = false;
    }
  }

  function updateFontSize(nextValue: number): void {
    fontSize = nextValue;
    if (fontSize === DEFAULT_FONT_SIZE) {
      fontSizeOverrideEnabled = false;
    }
  }

  function stepFontSize(delta: number): void {
    updateFontSize(Math.max(8, Math.min(32, fontSize + delta)));
  }
</script>

<div>
  <div class="style-panel-header">
    <div>
      <p class="style-panel-kicker">{sectionScope} fonts</p>
    </div>
  </div>

  <div class="style-tool-grid">
    <section class="style-tool-card">
      <div class="style-tool-card-header">
        <div>
          <h4>font selection</h4>
          <span>{fontSelectionOverrideEnabled ? 'override on' : 'inherited'}</span>
        </div>
        <StyleSlideToggle bind:checked={fontSelectionOverrideEnabled} />
      </div>
      <div class="style-picker-surface">
        <select
          class="style-select"
          value={fontFamily}
          aria-label={`${sectionScope} font family`}
          on:change={(event) => updateFontFamily((event.currentTarget as HTMLSelectElement).value)}
        >
          <option value="inherit">inherit</option>
          <option value="JetBrains Mono">JetBrains Mono</option>
          <option value="system-ui">System UI</option>
          <option value="serif">Serif</option>
        </select>
        <div class="style-picker-line short"></div>
        <div class="style-picker-line"></div>
        <div class="style-picker-line medium"></div>
      </div>
    </section>

    <section class="style-tool-card">
      <div class="style-tool-card-header">
        <div>
          <h4>font size</h4>
          <span>{fontSizeOverrideEnabled ? 'override on' : 'inherited'}</span>
        </div>
        <StyleSlideToggle bind:checked={fontSizeOverrideEnabled} />
      </div>
      <div class="style-size-surface">
        <div class="style-size-stepper">
          <button
            type="button"
            class="style-stepper-button"
            aria-label="decrease font size"
            on:click={() => stepFontSize(-1)}
          >
            -
          </button>
          <input
            class="style-stepper-value"
            type="number"
            min="8"
            max="32"
            step="1"
            value={fontSize}
            aria-label={`${sectionScope} font size`}
            on:input={(event) => updateFontSize(Number((event.currentTarget as HTMLInputElement).value))}
          />
          <button
            type="button"
            class="style-stepper-button"
            aria-label="increase font size"
            on:click={() => stepFontSize(1)}
          >
            +
          </button>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .style-panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .style-panel-kicker {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 400;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--text-bright);
  }

  .style-panel-copy {
    margin-top: 0.35rem;
    color: var(--text-dim);
    line-height: 1.45;
  }

  .style-tool-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
    margin-top: 0.95rem;
  }

  .style-tool-card {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
    padding: 0.85rem;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .style-tool-card-header {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .style-tool-card-header h4 {
    font-family: var(--font-ui);
    font-size: 0.7rem;
    font-weight: 400;
    letter-spacing: 0.2em;
    text-transform: uppercase;
  }

  .style-tool-card-header span {
    color: var(--text-dim);
    font-size: 0.72rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .style-picker-surface {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .style-select {
    width: 100%;
    min-height: 2.05rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
      rgba(255, 255, 255, 0.02);
    color: var(--text-bright);
    padding: 0 0.65rem;
    outline: none;
  }

  .style-picker-line {
    height: 2.05rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
      rgba(255, 255, 255, 0.02);
  }

  .style-picker-line.short {
    width: 55%;
  }

  .style-picker-line.medium {
    width: 78%;
  }

  .style-size-surface {
    display: flex;
    align-items: center;
    min-height: 4.35rem;
  }

  .style-size-stepper {
    display: grid;
    grid-template-columns: 2.2rem minmax(0, 1fr) 2.2rem;
    width: 100%;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.025);
    overflow: hidden;
  }

  .style-stepper-button,
  .style-stepper-value {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 2.1rem;
    font-family: var(--font-ui);
    font-size: 0.7rem;
    letter-spacing: 0.12em;
  }

  .style-stepper-button {
    color: var(--text-dim);
    background: rgba(255, 255, 255, 0.03);
    border: 0;
    cursor: pointer;
  }

  .style-stepper-value {
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--text-bright);
    text-align: center;
    outline: none;
  }

  @media (max-width: 640px) {
    .style-tool-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
