<script lang="ts">
  import { STYLE_SECTION_CONTENT, type StyleSectionScope } from './style-settings';
  import StyleBackgroundImageSection from './StyleBackgroundImageSection.svelte';
  import StyleColorSetting from './StyleColorSetting.svelte';

  export let sectionScope: StyleSectionScope;
</script>

<div>
  <div class="style-panel-header">
  </div>

  <div class="style-color-grid">
    <StyleColorSetting sectionScope={sectionScope} channel="foreground" />
    <StyleColorSetting sectionScope={sectionScope} channel="background" />
    <div class="style-background-span">
      <StyleBackgroundImageSection sectionScope={sectionScope} />
    </div>
  </div>
</div>

<style>
  .style-panel {
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
      rgba(8, 8, 8, 0.9);
    padding: 1rem;
  }

  .style-panel-header h3 {
    font-family: var(--font-ui);
    font-size: 0.72rem;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-bright);
  }

  .style-panel-header p {
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
