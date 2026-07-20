<script lang="ts">
  import StyleSlideToggle from './StyleSlideToggle.svelte';
  import {
    type StyleSectionEditor,
    type StyleSectionScope,
    type StyleSectionValue,
  } from './style-settings';

  export let sectionScope: StyleSectionScope;
  export let section: StyleSectionEditor;
  export let defaults: StyleSectionValue;
  export let onChange: (nextSection: StyleSectionEditor) => void = () => {};

  const FONT_CHOICES: Array<{ value: string; label: string }> = [
    { value: 'var(--font-mono)', label: 'Internal: JetBrains Mono' },
    { value: 'system-ui', label: 'Internal: System UI' },
    { value: 'serif', label: 'Internal: Serif' },
  ];

  function updateSection(nextSection: StyleSectionEditor): void {
    onChange(nextSection);
  }

  function updateFontFamily(nextValue: string): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      fontFamily: nextValue,
      fontFamilyEnabled: true,
    };

    updateSection(nextSection);
  }

  function updateFontFamilyEnabled(nextEnabled: boolean): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      fontFamilyEnabled: nextEnabled,
    };

    updateSection(nextSection);
  }

  function updateFontSize(nextValue: number): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      fontSize: nextValue,
      fontSizeEnabled: true,
    };

    updateSection(nextSection);
  }

  function updateFontSizeEnabled(nextEnabled: boolean): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      fontSizeEnabled: nextEnabled,
    };

    updateSection(nextSection);
  }

  function stepFontSize(delta: number): void {
    updateFontSize(Math.max(8, Math.min(32, section.fontSize + delta)));
  }

  let displayFontFamily: string;
  let displayFontSize: number;

  $: displayFontFamily = section.fontFamilyEnabled ? section.fontFamily : defaults.fontFamily;
  $: displayFontSize = section.fontSizeEnabled ? section.fontSize : defaults.fontSize;
</script>

<div>
  <div class="style-tool-grid">
    <section class="style-tool-card">
      <div class="style-tool-card-header">
        <div>
          <h4>font selection</h4>
          <span>{section.fontFamilyEnabled ? 'override on' : 'inherited'}</span>
        </div>
        <StyleSlideToggle
          checked={section.fontFamilyEnabled}
          on:change={(event) => updateFontFamilyEnabled(event.detail)}
        />
      </div>
      <div class="style-picker-surface">
        <select
          class="style-select"
          value={displayFontFamily}
          aria-label={`${sectionScope} font family`}
          on:change={(event) => updateFontFamily((event.currentTarget as HTMLSelectElement).value)}
        >
          {#each FONT_CHOICES as choice}
            <option value={choice.value}>{choice.label}</option>
          {/each}
        </select>
      </div>
    </section>

    <section class="style-tool-card">
      <div class="style-tool-card-header">
        <div>
          <h4>font size</h4>
          <span>{section.fontSizeEnabled ? 'override on' : 'inherited'}</span>
        </div>
        <StyleSlideToggle
          checked={section.fontSizeEnabled}
          on:change={(event) => updateFontSizeEnabled(event.detail)}
        />
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
            value={displayFontSize}
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
    background-color: var(--surface);
    background-image:
      linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
    color: var(--text-bright);
    padding: 0 0.65rem;
    appearance: none;
    -webkit-appearance: none;
    color-scheme: dark;
    outline: none;
  }

  .style-select option {
    background: var(--surface);
    color: var(--text-bright);
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
