<script lang="ts">
  import StyleColorsSection from './StyleColorsSection.svelte';
  import StyleFontsSection from './StyleFontsSection.svelte';
  import {
    getStyleScopeLabel,
    getStyleScopePath,
    getStyleScopeSummary,
    resolveAppStyleEditor,
    type AppStyleEditor,
    type StyleSectionEditor,
    type StyleSectionScope,
    type StyleSectionValue,
    type StyleScope,
    DEFAULT_APP_STYLE_VALUES,
  } from './style-settings';

  export let storageScope: StyleScope;
  export let style: AppStyleEditor;
  export let onChange: (nextStyle: AppStyleEditor) => void = () => {};

  $: previewStyle = resolveAppStyleEditor(style);

  function updateSection(sectionScope: StyleSectionScope, nextSection: StyleSectionEditor): void {
    onChange({
      ...style,
      [sectionScope]: nextSection,
    });
  }

  function getPreviewBlockStyle(section: StyleSectionValue): string {
    const parts = [
      `font-family:${section.fontFamily}`,
      `font-size:${section.fontSize}px`,
      `color:${section.foregroundColor}`,
      `background:${section.backgroundColor}`,
    ];

    if (section.backgroundImage.path.trim()) {
      parts.push(`background-image:url("${section.backgroundImage.path.replaceAll('"', '\\"')}")`);
      parts.push(`background-repeat:${section.backgroundImage.fit === 'repeat' ? 'repeat' : 'no-repeat'}`);
      parts.push(`background-size:${section.backgroundImage.fit === 'repeat' ? 'auto' : section.backgroundImage.fit}`);
    }

    return parts.join(';');
  }

  function describePreview(section: StyleSectionValue): string {
    const pieces = [
      section.fontFamily,
      `${section.fontSize}px`,
      section.foregroundColor,
      section.backgroundColor,
    ];

    if (section.backgroundImage.path.trim()) {
      pieces.push(`image ${section.backgroundImage.fit} ${section.backgroundImage.opacity}%`);
    }

    return pieces.join(' · ');
  }
</script>

<section class="style-settings" aria-label={getStyleScopeLabel(storageScope)}>
  <div class="style-layout">
    <div class="style-column style-column-main">
      <section class="style-panel style-context-panel">
        <div class="style-panel-header">
          <div>
            <p class="style-eyebrow">style settings</p>
            <h3>Scope: {getStyleScopeLabel(storageScope)}</h3>
            <p class="style-summary">{getStyleScopeSummary(storageScope)}</p>
          </div>
        </div>
      </section>

      <section class="style-panel style-context-panel">
        <div class="style-panel-header">
          <p class="style-eyebrow">output</p>
        </div>
        <StyleFontsSection
          sectionScope="output"
          section={style.output}
          defaults={DEFAULT_APP_STYLE_VALUES.output}
          onChange={(nextSection) => updateSection('output', nextSection)}
        />
        <StyleColorsSection
          sectionScope="output"
          section={style.output}
          defaults={DEFAULT_APP_STYLE_VALUES.output}
          onChange={(nextSection) => updateSection('output', nextSection)}
        />
      </section>

      <section class="style-panel style-context-panel">
        <div class="style-panel-header">
          <p class="style-eyebrow">input</p>
        </div>
        <StyleFontsSection
          sectionScope="input"
          section={style.input}
          defaults={DEFAULT_APP_STYLE_VALUES.input}
          onChange={(nextSection) => updateSection('input', nextSection)}
        />
        <StyleColorsSection
          sectionScope="input"
          section={style.input}
          defaults={DEFAULT_APP_STYLE_VALUES.input}
          onChange={(nextSection) => updateSection('input', nextSection)}
        />
      </section>
    </div>

    <aside class="style-column style-column-aside">
      <section class="style-preview-panel">
        <div class="style-preview-scroll">
          <div class="style-preview-scroll-header">
            <h4>preview</h4>
          </div>
          <div class="style-preview-stage">
            <div class="style-preview-output" style={getPreviewBlockStyle(previewStyle.output)}>
              <div class="style-preview-label">output sample</div>
              <div class="style-preview-text">The quick brown fox jumps over the lazy dog.</div>
              <div class="style-preview-text muted">
                Another line demonstrates the current output styling.
              </div>
              <div class="style-preview-meta">{describePreview(previewStyle.output)}</div>
            </div>

            <div class="style-preview-input" style={getPreviewBlockStyle(previewStyle.input)}>
              <div class="style-preview-label">input sample</div>
              <div class="style-preview-text">&gt; look north</div>
              <div class="style-preview-meta">{describePreview(previewStyle.input)}</div>
            </div>
          </div>
        </div>
      </section>
    </aside>
  </div>
</section>

<style>
  .style-settings {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-width: 0;
    color: var(--text-bright);
  }

  .style-eyebrow {
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.26em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .style-context-panel h3 {
    margin-top: 0.35rem;
    font-family: var(--font-ui);
    font-size: 1rem;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .style-summary {
    margin-top: 0.45rem;
    max-width: 42rem;
    color: var(--text-bright);
    line-height: 1.45;
  }

  .style-layout {
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr);
    gap: 0.9rem;
    min-width: 0;
  }

  .style-column {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    min-width: 0;
  }

  .style-panel,
  .style-preview-panel {
    border: 1px solid var(--border);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01)),
      rgba(8, 8, 8, 0.9);
    padding: 1rem;
  }

  .style-panel-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .style-panel-chip {
    flex: 0 0 auto;
    padding: 0.32rem 0.55rem;
    border: 1px solid var(--border);
    background: rgba(255, 255, 255, 0.03);
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 0.65rem;
    letter-spacing: 0.15em;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .style-preview-panel {
    display: flex;
    flex-direction: column;
    gap: 0.95rem;
    min-height: 100%;
  }

  .style-preview-scroll {
    position: sticky;
    top: 1rem;
    z-index: 1;
    align-self: start;
  }

  .style-preview-scroll-header {
    margin-bottom: 0.6rem;
    padding: 0 0.15rem;
  }

  .style-preview-scroll-header h4 {
    font-family: var(--font-ui);
    font-size: 0.7rem;
    font-weight: 400;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--text-bright);
  }

  .style-preview-stage {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
  }

  .style-preview-output,
  .style-preview-input {
    display: flex;
    flex-direction: column;
    gap: 0.55rem;
    padding: 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.025);
    background-clip: padding-box;
  }

  .style-preview-label {
    font-family: var(--font-ui);
    font-size: 0.66rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .style-preview-text {
    line-height: 1.45;
    color: var(--text-bright);
  }

  .style-preview-text.muted {
    color: var(--text-dim);
  }

  .style-preview-meta {
    font-family: var(--font-ui);
    font-size: 0.64rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--text-dim);
    line-height: 1.4;
  }

  @media (max-width: 960px) {
    .style-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    .style-panel-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
