<script lang="ts">
  import StyleColorsSection from './StyleColorsSection.svelte';
  import StyleFontsSection from './StyleFontsSection.svelte';
  import {
    getStyleScopeLabel,
    getStyleScopePath,
    getStyleScopeSummary,
    type StyleScope,
  } from './style-settings';

  export let storageScope: StyleScope;
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
        <StyleFontsSection sectionScope="output" />
        <StyleColorsSection sectionScope="output" />
      </section>

      <section class="style-panel style-context-panel">
        <div class="style-panel-header">
          <p class="style-eyebrow">input</p>
        </div>
        <StyleFontsSection sectionScope="input" />
        <StyleColorsSection sectionScope="input" />
      </section>
    </div>

    <aside class="style-column style-column-aside">
      <section class="style-preview-panel">

        <div class="style-preview-scroll">
          <div class="style-preview-scroll-header">
            <h4>preview</h4>
          </div>
          <div class="style-preview-stage">
            <div class="style-preview-output">
              <div class="style-preview-label">output sample</div>
              <div class="style-preview-text">The quick brown fox jumps over the lazy dog.</div>
              <div class="style-preview-text muted">
                Another line demonstrates the current output styling.
              </div>
            </div>

            <div class="style-preview-input">
              <div class="style-preview-label">input sample</div>
              <div class="style-preview-text">&gt; look north</div>
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
  }

  .style-preview-label {
    font-family: var(--font-ui);
    font-size: 0.66rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .style-preview-text {
    font-size: 0.9rem;
    line-height: 1.45;
    color: var(--text-bright);
  }

  .style-preview-text.muted {
    color: var(--text-dim);
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
