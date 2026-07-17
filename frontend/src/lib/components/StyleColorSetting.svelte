<script lang="ts">
  import { STYLE_COLOR_CHANNEL_LABELS, type StyleColorChannel, type StyleSectionScope } from './style-settings';

  export let sectionScope: StyleSectionScope;
  export let channel: StyleColorChannel;
  export let value = 'inherit';
  export let defaultValue = 'inherit';
  export let onChange: (nextValue: string) => void = () => {};
</script>

<section class="style-color-card">
  <div class="style-tool-card-header">
    <div>
      <h4>{sectionScope} {STYLE_COLOR_CHANNEL_LABELS[channel]} color</h4>
      <span>{value.trim().toLowerCase() === defaultValue.trim().toLowerCase() ? 'inherited' : 'override ready'}</span>
    </div>
  </div>

  <div class="style-color-row">
    <div class="style-color-swatch" aria-hidden="true" style={`background:${value};`}></div>
    <div class="style-color-copy">
      <input
        class="style-color-input"
        type="text"
        value={value}
        spellcheck="false"
        aria-label={`${STYLE_COLOR_CHANNEL_LABELS[channel]} color value`}
        on:input={(event) => onChange((event.currentTarget as HTMLInputElement).value)}
      />
      <div class="style-color-line medium"></div>
    </div>
  </div>
</section>

<style>
  .style-color-card {
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

  .style-color-row {
    display: grid;
    grid-template-columns: 2.9rem minmax(0, 1fr);
    gap: 0.75rem;
    align-items: center;
  }

  .style-color-swatch {
    width: 2.9rem;
    height: 2.9rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04)),
      rgba(255, 255, 255, 0.02);
  }

  .style-color-copy {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .style-color-input {
    width: 100%;
    background: var(--input-bg);
    color: var(--text-bright);
    border: 1px solid rgba(255, 255, 255, 0.1);
    padding: 0.5rem 0.6rem;
    outline: none;
  }

  .style-color-input:focus {
    border-color: rgba(74, 158, 255, 0.42);
  }

  .style-color-line {
    height: 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
      rgba(255, 255, 255, 0.02);
  }

  .style-color-line.medium {
    width: 82%;
  }
</style>
