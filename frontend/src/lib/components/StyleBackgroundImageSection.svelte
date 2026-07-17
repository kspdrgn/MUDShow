<script lang="ts">
  import { type StyleSectionScope } from './style-settings';
  import StyleSlideToggle from './StyleSlideToggle.svelte';

  export let sectionScope: StyleSectionScope;

  const DEFAULT_IMAGE_PATH = '';
  const DEFAULT_IMAGE_FIT = 'cover';
  const DEFAULT_IMAGE_OPACITY = 100;

  let overrideEnabled = false;
  let imagePath = DEFAULT_IMAGE_PATH;
  let imageFit = DEFAULT_IMAGE_FIT;
  let imageOpacity = DEFAULT_IMAGE_OPACITY;

  function normalizePath(value: string): string {
    return value.trim();
  }

  function syncOverrideState(): void {
    if (
      normalizePath(imagePath) === DEFAULT_IMAGE_PATH &&
      imageFit === DEFAULT_IMAGE_FIT &&
      imageOpacity === DEFAULT_IMAGE_OPACITY
    ) {
      overrideEnabled = false;
    }
  }

  function updateImagePath(nextValue: string): void {
    imagePath = nextValue;
    syncOverrideState();
  }

  function updateImageFit(nextValue: string): void {
    imageFit = nextValue;
    syncOverrideState();
  }

  function updateImageOpacity(nextValue: number): void {
    imageOpacity = nextValue;
    syncOverrideState();
  }
</script>

<section class="style-background-card">
  <div class="style-tool-card-header">
    <div>
      <h4>{sectionScope} background image</h4>
      <span>{overrideEnabled ? 'override on' : 'inherited'}</span>
    </div>
    <StyleSlideToggle bind:checked={overrideEnabled} />
  </div>

  <div class="style-image-grid">
    <div class="style-image-row">
      <button type="button" class="style-image-button">choose file</button>
      <input
        class="style-image-path"
        type="text"
        value={imagePath}
        spellcheck="false"
        aria-label="background image path display"
        on:input={(event) => updateImagePath((event.currentTarget as HTMLInputElement).value)}
      />
    </div>
    <div class="style-image-row">
      <select
        class="style-image-select"
        value={imageFit}
        aria-label="background image fit"
        on:change={(event) => updateImageFit((event.currentTarget as HTMLSelectElement).value)}
      >
        <option value="cover">cover</option>
        <option value="contain">contain</option>
        <option value="repeat">repeat</option>
      </select>
      <label class="style-image-select short">
        <span class="style-image-opacity-label">{imageOpacity}%</span>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={imageOpacity}
          aria-label="background image opacity"
          on:input={(event) => updateImageOpacity(Number((event.currentTarget as HTMLInputElement).value))}
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
