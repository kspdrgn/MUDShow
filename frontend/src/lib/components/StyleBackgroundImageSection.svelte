<script lang="ts">
  import { type StyleSectionScope } from './style-settings';

  export let sectionScope: StyleSectionScope;
</script>

<section class="style-background-card">
  <div class="style-tool-card-header">
    <h4>background image</h4>
  </div>

  <div class="style-image-grid">
    <div class="style-image-row">
      <div class="style-image-button">choose file</div>
      <div class="style-image-path"></div>
    </div>
    <div class="style-image-row">
      <div class="style-image-select"></div>
      <div class="style-image-select short"></div>
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
  }

  .style-image-path {
    min-width: 0;
  }

  .style-image-select {
    min-height: 2.05rem;
  }

  .style-image-select.short {
    width: 55%;
  }
</style>
