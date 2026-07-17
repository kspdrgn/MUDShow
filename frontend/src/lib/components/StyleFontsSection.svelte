<script lang="ts">
  import { STYLE_SECTION_CONTENT, type StyleSectionScope } from './style-settings';

  export let sectionScope: StyleSectionScope;
</script>

<section class="style-panel">
  <div class="style-panel-header">
    <div>
      <h3>{STYLE_SECTION_CONTENT[sectionScope].title}</h3>
      <p>{STYLE_SECTION_CONTENT[sectionScope].description}</p>
    </div>
  </div>

  <div class="style-tool-grid">
    <section class="style-tool-card">
      <div class="style-tool-card-header">
        <h4>font picker</h4>
        <span>{sectionScope}</span>
      </div>
      <div class="style-picker-surface">
        <div class="style-picker-line short"></div>
        <div class="style-picker-line"></div>
        <div class="style-picker-line medium"></div>
      </div>
    </section>

    <section class="style-tool-card">
      <div class="style-tool-card-header">
        <h4>font size</h4>
        <span>{sectionScope}</span>
      </div>
      <div class="style-size-surface">
        <div class="style-size-stepper">
          <span class="style-stepper-button">-</span>
          <span class="style-stepper-value">16</span>
          <span class="style-stepper-button">+</span>
        </div>
      </div>
    </section>
  </div>
</section>

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
  }

  .style-stepper-value {
    color: var(--text-bright);
  }

  @media (max-width: 640px) {
    .style-tool-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
