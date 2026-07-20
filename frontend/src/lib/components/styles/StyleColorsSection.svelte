<script lang="ts">
  import StyleBackgroundImageSection from './StyleBackgroundImageSection.svelte';
  import StyleColorSetting from './StyleColorSetting.svelte';
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

  function updateSection(nextSection: StyleSectionEditor): void {
    onChange(nextSection);
  }

  function updateForegroundColor(nextValue: string): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      foregroundColor: nextValue,
      foregroundColorEnabled: true,
    };

    updateSection(nextSection);
  }

  function updateBackgroundColor(nextValue: string): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      backgroundColor: nextValue,
      backgroundColorEnabled: true,
    };

    updateSection(nextSection);
  }

  function updateForegroundColorEnabled(nextEnabled: boolean): void {
    updateSection({
      ...section,
      foregroundColorEnabled: nextEnabled,
    });
  }

  function updateBackgroundColorEnabled(nextEnabled: boolean): void {
    updateSection({
      ...section,
      backgroundColorEnabled: nextEnabled,
    });
  }

  let displayForegroundColor: string;
  let displayBackgroundColor: string;

  $: displayForegroundColor = section.foregroundColorEnabled ? section.foregroundColor : defaults.foregroundColor;
  $: displayBackgroundColor = section.backgroundColorEnabled ? section.backgroundColor : defaults.backgroundColor;
</script>

<div>
  <div class="style-panel-header">
    <div>
      <p class="style-panel-kicker">{STYLE_SECTION_CONTENT[sectionScope].title} colors</p>
    </div>
  </div>

  <div class="style-color-grid">
    <StyleColorSetting
      sectionScope={sectionScope}
      channel="foreground"
      value={displayForegroundColor}
      defaultValue={defaults.foregroundColor}
      enabled={section.foregroundColorEnabled}
      onChange={updateForegroundColor}
      onEnabledChange={updateForegroundColorEnabled}
    />
    <StyleColorSetting
      sectionScope={sectionScope}
      channel="background"
      value={displayBackgroundColor}
      defaultValue={defaults.backgroundColor}
      enabled={section.backgroundColorEnabled}
      onChange={updateBackgroundColor}
      onEnabledChange={updateBackgroundColorEnabled}
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
