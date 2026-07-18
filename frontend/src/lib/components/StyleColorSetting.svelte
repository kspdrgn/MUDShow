<script lang="ts">
  import StyleSlideToggle from './StyleSlideToggle.svelte';
  import {
    STYLE_COLOR_CHANNEL_LABELS,
    type StyleColorChannel,
    type StyleSectionScope,
  } from './style-settings';

  export let sectionScope: StyleSectionScope;
  export let channel: StyleColorChannel;
  export let value = '';
  export let defaultValue = '';
  export let enabled = false;
  export let disabled = false;
  export let onChange: (nextValue: string) => void = () => {};
  export let onEnabledChange: (nextEnabled: boolean) => void = () => {};

  function isHexColor(input: string): boolean {
    return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(input.trim());
  }

  function normalizeHexColor(input: string): string | null {
    const trimmed = input.trim();
    const match = trimmed.match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i);

    if (!match) {
      return null;
    }

    const hex = match[1].toLowerCase();
    if (hex.length === 3) {
      return `#${hex
        .split('')
        .map((character) => character + character)
        .join('')}`;
    }

    return `#${hex}`;
  }

  function getPickerValue(inputValue: string): string {
    const currentValue = inputValue.trim();
    if (isHexColor(currentValue)) {
      return currentValue.toLowerCase();
    }

    const fallbackValue = defaultValue.trim();
    if (isHexColor(fallbackValue)) {
      return fallbackValue.toLowerCase();
    }

    return '#000000';
  }

  function updateColor(nextValue: string): void {
    onChange(normalizeHexColor(nextValue) ?? nextValue);
  }

  function updateEnabled(nextEnabled: boolean): void {
    onEnabledChange(nextEnabled);
  }

  async function copyColor(): Promise<void> {
    const textToCopy = displayValue.trim();

    if (!textToCopy) {
      return;
    }

    await navigator.clipboard.writeText(textToCopy);
  }

  $: displayValue = enabled ? value : defaultValue;
  $: toggleLabel = `Toggle custom override for the ${STYLE_COLOR_CHANNEL_LABELS[channel]} color`;
  $: toggleTitle = enabled
    ? `Turn this off to inherit the default ${STYLE_COLOR_CHANNEL_LABELS[channel]} color.`
    : `Turn this on to save a custom override for the ${STYLE_COLOR_CHANNEL_LABELS[channel]} color.`;
</script>

<section class="style-color-card">
  <div class="style-tool-card-header">
    <div>
      <h4>{STYLE_COLOR_CHANNEL_LABELS[channel]} color</h4>
    </div>
    <StyleSlideToggle
      checked={enabled}
      disabled={disabled}
      ariaLabel={toggleLabel}
      title={toggleTitle}
      on:change={(event) => updateEnabled(event.detail)}
    />
  </div>

  <div class="style-color-row">
    <label class="style-color-picker" aria-label={`${sectionScope} ${STYLE_COLOR_CHANNEL_LABELS[channel]} color picker`}>
      <input
        type="color"
        value={getPickerValue(displayValue)}
        disabled={disabled}
        aria-label={`${sectionScope} ${STYLE_COLOR_CHANNEL_LABELS[channel]} color picker`}
        on:input={(event) => updateColor((event.currentTarget as HTMLInputElement).value)}
      />
    </label>
    <div class="style-color-copy">
      <div class="style-color-copy-row">
        <input
          class="style-color-input"
          type="text"
          value={displayValue}
          disabled={disabled}
          spellcheck="false"
          aria-label={`${sectionScope} ${STYLE_COLOR_CHANNEL_LABELS[channel]} color`}
          on:input={(event) => updateColor((event.currentTarget as HTMLInputElement).value)}
          on:paste={(event) => {
            const pastedText = event.clipboardData?.getData('text') ?? '';
            const normalizedText = normalizeHexColor(pastedText);

            if (normalizedText !== null) {
              event.preventDefault();
              updateColor(normalizedText);
            }
          }}
        />
        <button
          type="button"
          class="style-color-copy-button"
          disabled={disabled}
          aria-label={`Copy ${sectionScope} ${STYLE_COLOR_CHANNEL_LABELS[channel]} color`}
          title={`Copy ${sectionScope} ${STYLE_COLOR_CHANNEL_LABELS[channel]} color`}
          on:click={() => void copyColor()}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path d="M16 1H8a2 2 0 0 0-2 2v2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2v-2h2a2 2 0 0 0 2-2V7l-4-6Zm-2 18H4V7h2v8a2 2 0 0 0 2 2h6v2Zm2-4H8V3h7.17L16 5.83V15Z" />
          </svg>
        </button>
      </div>
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
    align-items: center;
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

  .style-color-row {
    display: grid;
    grid-template-columns: 2.9rem minmax(0, 1fr);
    gap: 0.75rem;
    align-items: center;
  }

  .style-color-picker {
    width: 2.9rem;
    height: 2.9rem;
    display: block;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background:
      linear-gradient(135deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0.04)),
      rgba(255, 255, 255, 0.02);
  }

  .style-color-picker input[type='color'] {
    width: 100%;
    height: 100%;
    border: 0;
    padding: 0;
    background: transparent;
    cursor: pointer;
    appearance: none;
    -webkit-appearance: none;
  }

  .style-color-picker input[type='color']::-webkit-color-swatch-wrapper {
    padding: 0;
  }

  .style-color-picker input[type='color']::-webkit-color-swatch {
    border: 0;
  }

  .style-color-picker input[type='color']::-moz-color-swatch {
    border: 0;
  }

  .style-color-copy {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
  }

  .style-color-copy-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.45rem;
    align-items: center;
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

  .style-color-copy-button {
    width: 2.05rem;
    min-height: 2.05rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background:
      linear-gradient(90deg, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.02)),
      rgba(255, 255, 255, 0.02);
    color: var(--text-bright);
    cursor: pointer;
  }

  .style-color-copy-button svg {
    width: 1rem;
    height: 1rem;
    fill: currentColor;
    display: block;
  }

  .style-color-copy-button:hover:not(:disabled),
  .style-color-copy-button:focus-visible:not(:disabled) {
    border-color: rgba(74, 158, 255, 0.42);
  }

  .style-color-copy-button:disabled {
    cursor: default;
    opacity: 0.55;
  }

</style>
