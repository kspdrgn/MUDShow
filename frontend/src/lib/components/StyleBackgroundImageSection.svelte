<script lang="ts">
  import StyleSlideToggle from './StyleSlideToggle.svelte';
  import {
    type StyleSectionEditor,
    type StyleSectionScope,
    type StyleSectionValue,
    type StyleImageFit,
  } from './style-settings';

  export let sectionScope: StyleSectionScope;
  export let section: StyleSectionEditor;
  export let defaults: StyleSectionValue;
  export let onChange: (nextSection: StyleSectionEditor) => void = () => {};

  function updateBackgroundImagePath(nextValue: string): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      backgroundImagePath: nextValue,
      backgroundImageEnabled: true,
    };

    onChange(nextSection);
  }

  function updateBackgroundImageFit(nextValue: StyleImageFit): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      backgroundImageFit: nextValue,
      backgroundImageEnabled: true,
    };

    onChange(nextSection);
  }

  function updateBackgroundImageOpacity(nextValue: number): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      backgroundImageOpacity: nextValue,
      backgroundImageEnabled: true,
    };

    onChange(nextSection);
  }

  function updateBackgroundImageEnabled(nextEnabled: boolean): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      backgroundImageEnabled: nextEnabled,
    };

    onChange(nextSection);
  }

  let displayBackgroundImagePath: string;
  let displayBackgroundImageFit: StyleImageFit;
  let displayBackgroundImageOpacity: number;

  $: displayBackgroundImagePath = !section.backgroundImageEnabled
    ? defaults.backgroundImage.path
    : section.backgroundImagePath;
  $: displayBackgroundImageFit = !section.backgroundImageEnabled
    ? defaults.backgroundImage.fit
    : section.backgroundImageFit;
  $: displayBackgroundImageOpacity = !section.backgroundImageEnabled
    ? defaults.backgroundImage.opacity
    : section.backgroundImageOpacity;
</script>

<section class="style-background-card">
  <div class="style-tool-card-header">
    <div>
      <h4>{sectionScope} background image</h4>
      <span>{section.backgroundImageEnabled ? 'override on' : 'inherited'}</span>
    </div>
    <StyleSlideToggle
      checked={section.backgroundImageEnabled}
      on:change={(event) => updateBackgroundImageEnabled(event.detail)}
    />
  </div>

  <div class="style-image-grid">
    <div class="style-image-row">
      <button
        type="button"
        class="style-image-button"
      >
        choose file
      </button>
      <input
        class="style-image-path"
        type="text"
        value={displayBackgroundImagePath}
        spellcheck="false"
        aria-label={`${sectionScope} background image path`}
        on:input={(event) => updateBackgroundImagePath((event.currentTarget as HTMLInputElement).value)}
      />
    </div>
    <div class="style-image-row">
      <select
        class="style-image-select"
        value={displayBackgroundImageFit}
        aria-label={`${sectionScope} background image fit`}
        on:change={(event) =>
          updateBackgroundImageFit((event.currentTarget as HTMLSelectElement).value as StyleImageFit)}
      >
        <option value="cover">cover</option>
        <option value="contain">contain</option>
        <option value="repeat">repeat</option>
      </select>
      <label class="style-image-select short">
        <span class="style-image-opacity-label">{displayBackgroundImageOpacity}%</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={displayBackgroundImageOpacity}
          aria-label={`${sectionScope} background image opacity`}
          on:input={(event) =>
            updateBackgroundImageOpacity(Number((event.currentTarget as HTMLInputElement).value))}
        />
      </label>
    </div>
  </div>
</section>

<style>
  .style-background-card {
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

  .style-image-grid {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
  }

  .style-image-row {
    display: grid;
    grid-template-columns: minmax(7rem, 0.8fr) minmax(0, 1.2fr);
    gap: 0.55rem;
    align-items: center;
  }

  .style-image-button,
  .style-image-path,
  .style-image-select {
    min-height: 2.05rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
      rgba(255, 255, 255, 0.02);
  }

  .style-image-button {
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--text-bright);
    cursor: pointer;
  }

  .style-image-path {
    width: 100%;
    min-width: 0;
    color: var(--text-bright);
    padding: 0 0.65rem;
    outline: none;
  }

  .style-image-select {
    width: 100%;
    min-height: 2.05rem;
    color: var(--text-bright);
    outline: none;
    padding: 0 0.65rem;
  }

  .style-image-select.short {
    width: 55%;
    display: flex;
    align-items: center;
    gap: 0.55rem;
    padding-right: 0.7rem;
  }

  .style-image-opacity-label {
    min-width: 2.8rem;
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--text-bright);
  }

  .style-image-select.short input[type='range'] {
    flex: 1 1 auto;
    width: 100%;
  }
</style>
