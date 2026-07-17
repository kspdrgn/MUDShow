<script lang="ts">
  import { STYLE_SECTION_CONTENT, type StyleSectionScope } from './style-settings';
  import StyleBackgroundImageSection from './StyleBackgroundImageSection.svelte';
  import StyleColorSetting from './StyleColorSetting.svelte';
  import StyleSlideToggle from './StyleSlideToggle.svelte';

  export let sectionScope: StyleSectionScope;

  const DEFAULT_FOREGROUND_COLOR = 'inherit';
  const DEFAULT_BACKGROUND_COLOR = 'inherit';

  let overrideEnabled = false;
  let foregroundColor = DEFAULT_FOREGROUND_COLOR;
  let backgroundColor = DEFAULT_BACKGROUND_COLOR;

  function normalizeColor(value: string): string {
    return value.trim().toLowerCase();
  }

  function updateForegroundColor(nextValue: string): void {
    foregroundColor = nextValue;
    if (normalizeColor(foregroundColor) === normalizeColor(DEFAULT_FOREGROUND_COLOR)
      && normalizeColor(backgroundColor) === normalizeColor(DEFAULT_BACKGROUND_COLOR)) {
      overrideEnabled = false;
    }
  }

  function updateBackgroundColor(nextValue: string): void {
    backgroundColor = nextValue;
    if (normalizeColor(foregroundColor) === normalizeColor(DEFAULT_FOREGROUND_COLOR)
      && normalizeColor(backgroundColor) === normalizeColor(DEFAULT_BACKGROUND_COLOR)) {
      overrideEnabled = false;
    }
  }
</script>

<div>
  <div class="style-panel-header">
    <div>
      <p class="style-panel-kicker">{STYLE_SECTION_CONTENT[sectionScope].title} colors</p>
    </div>
    <StyleSlideToggle bind:checked={overrideEnabled} />
  </div>

  <div class="style-color-grid">
    <StyleColorSetting
      sectionScope={sectionScope}
      channel="foreground"
      value={foregroundColor}
      defaultValue={DEFAULT_FOREGROUND_COLOR}
      onChange={updateForegroundColor}
    />
    <StyleColorSetting
      sectionScope={sectionScope}
      channel="background"
      value={backgroundColor}
      defaultValue={DEFAULT_BACKGROUND_COLOR}
      onChange={updateBackgroundColor}
    />
    <div class="style-background-span">
      <StyleBackgroundImageSection sectionScope={sectionScope} />
    </div>
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

  .style-color-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.85rem;
    margin-top: 0.95rem;
  }

  .style-background-span {
    grid-column: span 2;
  }

  @media (max-width: 640px) {
    .style-color-grid {
      grid-template-columns: 1fr;
    }

    .style-background-span {
      grid-column: span 1;
    }
  }
</style>
