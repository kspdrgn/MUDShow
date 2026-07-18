<script lang="ts">
  import StyleBackgroundImageSection from './StyleBackgroundImageSection.svelte';
  import StyleColorSetting from './StyleColorSetting.svelte';
  import StyleSlideToggle from './StyleSlideToggle.svelte';
  import {
    STYLE_SECTION_CONTENT,
    type StyleSectionEditor,
    type StyleSectionScope,
    type StyleSectionValue,
  } from './style-settings';

  export let sectionScope: StyleSectionScope;
  export let section: StyleSectionEditor;
  export let defaults: StyleSectionValue;
  export let onChange: (nextSection: StyleSectionEditor) => void = () => {};

  function normalize(value: string): string {
    return value.trim().toLowerCase();
  }

  function matchesDefaultColors(nextSection: StyleSectionEditor): boolean {
    return (
      normalize(nextSection.foregroundColor) === normalize(defaults.foregroundColor) &&
      normalize(nextSection.backgroundColor) === normalize(defaults.backgroundColor)
    );
  }

  function updateSection(nextSection: StyleSectionEditor): void {
    onChange(nextSection);
  }

  function updateForegroundColor(nextValue: string): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      foregroundColor: nextValue,
      colorsEnabled:
        section.colorsEnabled && !matchesDefaultColors({ ...section, foregroundColor: nextValue }),
    };

    updateSection(nextSection);
  }

  function updateBackgroundColor(nextValue: string): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      backgroundColor: nextValue,
      colorsEnabled:
        section.colorsEnabled && !matchesDefaultColors({ ...section, backgroundColor: nextValue }),
    };

    updateSection(nextSection);
  }

  function updateColorsEnabled(nextEnabled: boolean): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      colorsEnabled: nextEnabled && !matchesDefaultColors(section),
    };

    updateSection(nextSection);
  }
</script>

<div>
  <div class="style-panel-header">
    <div>
      <p class="style-panel-kicker">{STYLE_SECTION_CONTENT[sectionScope].title} colors</p>
    </div>
    <StyleSlideToggle
      checked={section.colorsEnabled}
      label="override"
      on:change={(event) => updateColorsEnabled(event.detail)}
    />
  </div>

  <div class="style-color-grid">
    <StyleColorSetting
      sectionScope={sectionScope}
      channel="foreground"
      value={section.foregroundColor}
      defaultValue={defaults.foregroundColor}
      onChange={updateForegroundColor}
    />
    <StyleColorSetting
      sectionScope={sectionScope}
      channel="background"
      value={section.backgroundColor}
      defaultValue={defaults.backgroundColor}
      onChange={updateBackgroundColor}
    />
    <div class="style-background-span">
      <StyleBackgroundImageSection
        sectionScope={sectionScope}
        section={section}
        defaults={defaults}
        onChange={updateSection}
      />
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
