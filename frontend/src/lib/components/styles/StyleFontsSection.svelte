<script lang="ts">
  import { tick } from 'svelte';
  import {
    createSystemFontShelfEntry,
    listSystemFonts,
    normalizeFontShelf,
    type FontShelfEntry,
    type SystemFontFamily,
  } from '../../fonts';
  import StyleSlideToggle from './StyleSlideToggle.svelte';
  import {
    type StyleSectionEditor,
    type StyleSectionScope,
    type StyleSectionValue,
  } from './style-settings';

  export let sectionScope: StyleSectionScope;
  export let section: StyleSectionEditor;
  export let defaults: StyleSectionValue;
  export let fontShelf: FontShelfEntry[];
  export let onChange: (nextSection: StyleSectionEditor) => void = () => {};
  export let onFontShelfChange: (nextShelf: FontShelfEntry[]) => void = () => {};

  let pickerOpen = false;
  let pickerLoading = false;
  let pickerError = '';
  let pickerSearch = '';
  let pickerMonoFilter: 'fully-monospace' | 'has-monospace' | 'proportional' | 'all' = 'fully-monospace';
  let systemFonts: SystemFontFamily[] = [];
  let selectedSystemFamily: SystemFontFamily | null = null;
  let selectedSystemFace: SystemFontFamily['faces'][number] | null = null;
  let fontPickerListElement: HTMLDivElement | null = null;

  function updateSection(nextSection: StyleSectionEditor): void {
    onChange(nextSection);
  }

  function updateFontEntry(entry: FontShelfEntry): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      fontFamily: entry.cssFamily,
      fontWeight: entry.weight,
      fontStyle: entry.fontStyle,
      fontStretch: entry.stretch,
      fontFamilyEnabled: true,
    };

    updateSection(nextSection);
  }

  function updateFontFamilyEnabled(nextEnabled: boolean): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      fontFamilyEnabled: nextEnabled,
    };

    updateSection(nextSection);
  }

  function updateFontSize(nextValue: number): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      fontSize: nextValue,
      fontSizeEnabled: true,
    };

    updateSection(nextSection);
  }

  function updateFontSizeEnabled(nextEnabled: boolean): void {
    const nextSection: StyleSectionEditor = {
      ...section,
      fontSizeEnabled: nextEnabled,
    };

    updateSection(nextSection);
  }

  function stepFontSize(delta: number): void {
    updateFontSize(Math.max(8, Math.min(32, section.fontSize + delta)));
  }

  function addShelfEntry(entry: FontShelfEntry): void {
    onFontShelfChange(normalizeFontShelf([...fontShelf, entry]));
  }

  function deleteShelfEntry(entry: FontShelfEntry): void {
    if (entry.source === 'builtin') {
      return;
    }

    onFontShelfChange(fontShelf.filter((candidate) => candidate.id !== entry.id));
    if (currentShelfEntry?.id === entry.id) {
      updateSection({
        ...section,
        fontFamily: defaults.fontFamily,
        fontWeight: defaults.fontWeight,
        fontStyle: defaults.fontStyle,
        fontStretch: defaults.fontStretch,
        fontFamilyEnabled: false,
      });
    }
  }

  async function openSystemFontPicker(): Promise<void> {
    pickerOpen = true;
    pickerError = '';

    if (systemFonts.length > 0) {
      selectedSystemFamily = filteredSystemFonts[0] ?? systemFonts[0] ?? null;
      return;
    }

    pickerLoading = true;
    try {
      systemFonts = await listSystemFonts();
      selectedSystemFamily = filteredSystemFonts[0] ?? systemFonts[0] ?? null;
      if (systemFonts.length === 0) {
        pickerError = 'No system fonts were found.';
      }
    } catch (error) {
      console.error('failed to list system fonts:', error);
      pickerError = 'System fonts could not be loaded.';
    } finally {
      pickerLoading = false;
    }
  }

  function closeSystemFontPicker(): void {
    pickerOpen = false;
    pickerError = '';
  }

  function selectSystemFamily(family: SystemFontFamily): void {
    selectedSystemFamily = family;
    selectedSystemFace = family.faces[0] ?? null;
  }

  async function moveSelectedSystemFamily(delta: number): Promise<void> {
    if (filteredSystemFonts.length === 0) {
      return;
    }

    const currentIndex = selectedSystemFamily
      ? filteredSystemFonts.findIndex((family) => family.family === selectedSystemFamily?.family)
      : -1;
    const nextIndex = Math.max(0, Math.min(filteredSystemFonts.length - 1, currentIndex + delta));
    selectedSystemFamily = filteredSystemFonts[nextIndex] ?? null;

    await tick();
    const activeOption = fontPickerListElement?.querySelector<HTMLButtonElement>('.font-family-option.active');
    activeOption?.focus();
    activeOption?.scrollIntoView({
      block: 'nearest',
    });
  }

  function handleSystemFontListKeydown(event: KeyboardEvent): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }

    event.preventDefault();
    void moveSelectedSystemFamily(event.key === 'ArrowDown' ? 1 : -1);
  }

  function addSelectedSystemFamily(): void {
    if (!selectedSystemFamily || !selectedSystemFace) {
      return;
    }

    const entry = createSystemFontShelfEntry(selectedSystemFamily, selectedSystemFace);
    addShelfEntry(entry);
    updateFontEntry(entry);
    closeSystemFontPicker();
  }

  function isFaceOnShelf(face: SystemFontFamily['faces'][number]): boolean {
    return normalizedFontShelf.some((entry) =>
      entry.source === 'system' &&
      entry.family.toLowerCase() === face.family.toLowerCase() &&
      entry.weight === face.weight &&
      entry.fontStyle === (face.italic ? 'italic' : 'normal') &&
      entry.stretch === face.stretch &&
      entry.postscriptName === face.postscriptName,
    );
  }

  function isSelectedFaceOnShelf(): boolean {
    return selectedSystemFace !== null && isFaceOnShelf(selectedSystemFace);
  }

  function describeFace(face: SystemFontFamily['faces'][number]): string {
    const pieces = [face.styleName, `${face.weight}`];
    if (face.monospaced) {
      pieces.push('mono');
    }

    return pieces.join(' / ');
  }

  let displayFontFamily: string;
  let displayFontWeight: number;
  let displayFontStyle: 'normal' | 'italic';
  let displayFontStretch: string;
  let displayFontSize: number;
  let normalizedFontShelf: FontShelfEntry[];
  let currentShelfEntry: FontShelfEntry | null;
  let selectedFontEntryId: string;
  let filteredSystemFonts: SystemFontFamily[];

  $: displayFontFamily = section.fontFamilyEnabled ? section.fontFamily : defaults.fontFamily;
  $: displayFontWeight = section.fontFamilyEnabled ? section.fontWeight : defaults.fontWeight;
  $: displayFontStyle = section.fontFamilyEnabled ? section.fontStyle : defaults.fontStyle;
  $: displayFontStretch = section.fontFamilyEnabled ? section.fontStretch : defaults.fontStretch;
  $: displayFontSize = section.fontSizeEnabled ? section.fontSize : defaults.fontSize;
  $: normalizedFontShelf = normalizeFontShelf(fontShelf);
  $: currentShelfEntry = normalizedFontShelf.find((entry) =>
    entry.cssFamily === displayFontFamily &&
    entry.weight === displayFontWeight &&
    entry.fontStyle === displayFontStyle &&
    entry.stretch === displayFontStretch,
  ) ?? null;
  $: selectedFontEntryId = currentShelfEntry?.id ?? '__custom';
  $: filteredSystemFonts = systemFonts.filter((family) => {
    const searchText = pickerSearch.trim().toLowerCase();
    const activeMonoFilter = pickerMonoFilter;

    return (
      family.family.toLowerCase().includes(searchText) &&
      (
        activeMonoFilter === 'all' ||
        (activeMonoFilter === 'fully-monospace' && family.faces.length > 0 && family.faces.every((face) => face.monospaced)) ||
        (activeMonoFilter === 'has-monospace' && family.faces.some((face) => face.monospaced)) ||
        (activeMonoFilter === 'proportional' && !family.faces.some((face) => face.monospaced))
      )
    );
  });
  $: if (selectedSystemFamily && !filteredSystemFonts.some((family) => family.family === selectedSystemFamily?.family)) {
    selectedSystemFamily = filteredSystemFonts[0] ?? null;
  }
  $: if (selectedSystemFamily && (!selectedSystemFace || !selectedSystemFamily.faces.includes(selectedSystemFace))) {
    selectedSystemFace = selectedSystemFamily.faces[0] ?? null;
  }
</script>

<div>
  <div class="style-tool-grid">
    <section class="style-tool-card">
      <div class="style-tool-card-header">
        <div>
          <h4>font selection</h4>
          <span>{section.fontFamilyEnabled ? 'override on' : 'inherited'}</span>
        </div>
        <StyleSlideToggle
          checked={section.fontFamilyEnabled}
          on:change={(event) => updateFontFamilyEnabled(event.detail)}
        />
      </div>
      <div class="style-picker-surface">
        <select
          class="style-select"
          value={selectedFontEntryId}
          aria-label={`${sectionScope} font family`}
          on:change={(event) => {
            const entry = normalizedFontShelf.find((candidate) => candidate.id === (event.currentTarget as HTMLSelectElement).value);
            if (entry) {
              updateFontEntry(entry);
            }
          }}
        >
          <optgroup label="built in">
            {#each normalizedFontShelf.filter((entry) => entry.source === 'builtin') as choice}
              <option value={choice.id}>{choice.label}</option>
            {/each}
          </optgroup>
          {#if normalizedFontShelf.some((entry) => entry.source === 'system')}
            <optgroup label="system shelf">
              {#each normalizedFontShelf.filter((entry) => entry.source === 'system') as choice}
                <option value={choice.id}>
                  {choice.label}{choice.status === 'missing' ? ' (missing)' : ''}
                </option>
              {/each}
            </optgroup>
          {/if}
          {#if !currentShelfEntry}
            <option value="__custom">Custom: {displayFontFamily}</option>
          {/if}
        </select>
        <div class="style-font-actions">
          <button type="button" class="style-font-button" on:click={() => void openSystemFontPicker()}>
            add system font
          </button>
          {#if currentShelfEntry?.source === 'system'}
            <button
              type="button"
              class="style-font-button danger"
              title="Remove this font from the shelf."
              on:click={() => deleteShelfEntry(currentShelfEntry)}
            >
              delete
            </button>
          {/if}
        </div>
      </div>
    </section>

    <section class="style-tool-card">
      <div class="style-tool-card-header">
        <div>
          <h4>font size</h4>
          <span>{section.fontSizeEnabled ? 'override on' : 'inherited'}</span>
        </div>
        <StyleSlideToggle
          checked={section.fontSizeEnabled}
          on:change={(event) => updateFontSizeEnabled(event.detail)}
        />
      </div>
      <div class="style-size-surface">
        <div class="style-size-stepper">
          <button
            type="button"
            class="style-stepper-button"
            aria-label="decrease font size"
            on:click={() => stepFontSize(-1)}
          >
            -
          </button>
          <input
            class="style-stepper-value"
            type="number"
            min="8"
            max="32"
            step="1"
            value={displayFontSize}
            aria-label={`${sectionScope} font size`}
            on:input={(event) => updateFontSize(Number((event.currentTarget as HTMLInputElement).value))}
          />
          <button
            type="button"
            class="style-stepper-button"
            aria-label="increase font size"
            on:click={() => stepFontSize(1)}
          >
            +
          </button>
        </div>
      </div>
    </section>
  </div>
</div>

{#if pickerOpen}
  <div class="font-picker-backdrop" role="presentation" on:click={closeSystemFontPicker}>
    <div
      class="font-picker-dialog"
      role="dialog"
      aria-modal="true"
      aria-label="Add system font"
      tabindex="-1"
      on:click|stopPropagation
      on:keydown={(event) => {
        if (event.key === 'Escape') {
          closeSystemFontPicker();
        }
      }}
    >
      <div class="font-picker-header">
        <div>
          <h3>add system font</h3>
          <p>{pickerLoading ? 'loading installed fonts' : `${filteredSystemFonts.length} families`}</p>
        </div>
        <button type="button" class="font-picker-close" aria-label="close font picker" on:click={closeSystemFontPicker}>
          ×
        </button>
      </div>

      <input
        class="font-picker-search"
        type="search"
        placeholder="search fonts"
        value={pickerSearch}
        aria-label="search system fonts"
        on:input={(event) => (pickerSearch = (event.currentTarget as HTMLInputElement).value)}
      />

      <div class="font-filter-segments" aria-label="font spacing filter">
        <button
          type="button"
          class:active={pickerMonoFilter === 'fully-monospace'}
          on:click={() => (pickerMonoFilter = 'fully-monospace')}
        >
          fully monospace
        </button>
        <button
          type="button"
          class:active={pickerMonoFilter === 'has-monospace'}
          on:click={() => (pickerMonoFilter = 'has-monospace')}
        >
          has monospace
        </button>
        <button
          type="button"
          class:active={pickerMonoFilter === 'proportional'}
          on:click={() => (pickerMonoFilter = 'proportional')}
        >
          proportional
        </button>
        <button
          type="button"
          class:active={pickerMonoFilter === 'all'}
          on:click={() => (pickerMonoFilter = 'all')}
        >
          all
        </button>
      </div>

      {#if pickerError}
        <p class="font-picker-error">{pickerError}</p>
      {/if}

      <div class="font-picker-body">
        <div
          bind:this={fontPickerListElement}
          class="font-picker-list"
          aria-label="system font families"
        >
          {#if pickerLoading}
            <div class="font-picker-empty">loading</div>
          {:else if filteredSystemFonts.length === 0}
            <div class="font-picker-empty">no matches</div>
          {:else}
            {#each filteredSystemFonts as family}
              <button
                type="button"
                class:active={selectedSystemFamily?.family === family.family}
                class="font-family-option"
                on:click={() => selectSystemFamily(family)}
                on:keydown={handleSystemFontListKeydown}
              >
                <span>{family.family}</span>
                <small>{family.faces.length} styles</small>
              </button>
            {/each}
          {/if}
        </div>

        <div class="font-picker-detail">
          {#if selectedSystemFamily}
            {@const selectedCssFamily = `"${selectedSystemFamily.family.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}", var(--font-mono)`}
            <div class="font-family-preview" style={`font-family:${selectedCssFamily};`}>
              <h4>{selectedSystemFamily.family}</h4>
              <p>The quick brown fox jumps over the lazy dog.</p>
            </div>
            <div class="font-face-list">
              {#each selectedSystemFamily.faces as face}
                <label
                  class="font-face-row"
                  class:active={selectedSystemFace === face}
                  style={`font-family:${selectedCssFamily}; font-weight:${face.weight}; font-style:${face.italic ? 'italic' : 'normal'}; font-stretch:${face.stretch};`}
                >
                  <input
                    type="radio"
                    name={`${sectionScope}-system-font-face`}
                    checked={selectedSystemFace === face}
                    on:change={() => (selectedSystemFace = face)}
                  />
                  <span>{face.styleName}</span>
                  <small>{describeFace(face)}{isFaceOnShelf(face) ? ' / on shelf' : ''}</small>
                </label>
              {/each}
            </div>
            <button
              type="button"
              class="font-picker-add"
              disabled={selectedSystemFace === null || isSelectedFaceOnShelf()}
              on:click={addSelectedSystemFamily}
            >
              {isSelectedFaceOnShelf() ? 'already on shelf' : 'add to shelf'}
            </button>
          {:else}
            <div class="font-picker-empty">select a family</div>
          {/if}
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
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

  .style-font-actions {
    display: flex;
    gap: 0.45rem;
    flex-wrap: wrap;
  }

  .style-font-button {
    min-height: 1.85rem;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.035);
    color: var(--text-bright);
    font-family: var(--font-ui);
    font-size: 0.66rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    padding: 0 0.55rem;
    cursor: pointer;
  }

  .style-font-button:hover:not(:disabled),
  .style-font-button:focus-visible:not(:disabled) {
    border-color: rgba(255, 255, 255, 0.22);
    color: #ffffff;
  }

  .style-font-button.danger {
    color: var(--danger);
  }

  .style-font-button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }

  .style-select {
    width: 100%;
    min-height: 2.05rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background-color: var(--surface);
    background-image:
      linear-gradient(90deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02)),
      linear-gradient(180deg, rgba(255, 255, 255, 0.03), rgba(255, 255, 255, 0.01));
    color: var(--text-bright);
    padding: 0 0.65rem;
    appearance: none;
    -webkit-appearance: none;
    color-scheme: dark;
    outline: none;
  }

  .style-select option {
    background: var(--surface);
    color: var(--text-bright);
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
    border: 0;
    cursor: pointer;
  }

  .style-stepper-value {
    width: 100%;
    border: 0;
    background: transparent;
    color: var(--text-bright);
    text-align: center;
    outline: none;
  }

  .font-picker-backdrop {
    position: fixed;
    inset: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background: rgba(0, 0, 0, 0.72);
  }

  .font-picker-dialog {
    width: min(58rem, 100%);
    max-height: min(42rem, calc(100vh - 2rem));
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    border: 1px solid var(--border);
    background: rgba(8, 8, 8, 0.98);
    padding: 1rem;
    box-shadow: 0 1.2rem 3rem rgba(0, 0, 0, 0.55);
  }

  .font-picker-header {
    display: flex;
    justify-content: space-between;
    gap: 1rem;
  }

  .font-picker-header h3 {
    font-family: var(--font-ui);
    font-size: 0.82rem;
    font-weight: 400;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .font-picker-header p {
    margin-top: 0.25rem;
    color: var(--text-dim);
    font-size: 0.72rem;
  }

  .font-picker-close {
    width: 2rem;
    height: 2rem;
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.035);
    color: var(--text-bright);
    cursor: pointer;
  }

  .font-picker-search {
    min-height: 2.15rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    background: var(--surface);
    color: var(--text-bright);
    padding: 0 0.7rem;
    outline: none;
  }

  .font-filter-segments {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    border: 1px solid rgba(255, 255, 255, 0.09);
    background: rgba(255, 255, 255, 0.025);
    overflow: hidden;
  }

  .font-filter-segments button {
    min-height: 2rem;
    border: 0;
    border-right: 1px solid rgba(255, 255, 255, 0.07);
    background: transparent;
    color: var(--text-dim);
    font-family: var(--font-ui);
    font-size: 0.62rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .font-filter-segments button:last-child {
    border-right: 0;
  }

  .font-filter-segments button:hover,
  .font-filter-segments button.active {
    background: rgba(255, 255, 255, 0.07);
    color: var(--text-bright);
  }

  .font-picker-error {
    color: var(--danger);
    font-size: 0.78rem;
  }

  .font-picker-body {
    display: grid;
    grid-template-columns: minmax(12rem, 0.85fr) minmax(0, 1.15fr);
    gap: 0.75rem;
    min-height: 0;
  }

  .font-picker-list,
  .font-picker-detail {
    min-height: 18rem;
    max-height: min(29rem, calc(100vh - 12rem));
    overflow: auto;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.018);
  }

  .font-family-option {
    display: flex;
    width: 100%;
    flex-direction: column;
    align-items: flex-start;
    gap: 0.15rem;
    border: 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.055);
    background: transparent;
    color: var(--text-bright);
    padding: 0.55rem 0.65rem;
    text-align: left;
    cursor: pointer;
  }

  .font-family-option:hover,
  .font-family-option.active {
    background: rgba(255, 255, 255, 0.06);
  }

  .font-family-option small,
  .font-face-row small {
    color: var(--text-dim);
    font-size: 0.68rem;
  }

  .font-picker-detail {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.75rem;
  }

  .font-family-preview {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: #050505;
    padding: 0.8rem;
  }

  .font-family-preview h4 {
    font-size: 1rem;
    font-weight: 400;
  }

  .font-family-preview p {
    font-size: 1.05rem;
    line-height: 1.5;
  }

  .font-face-list {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
  }

  .font-face-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    border: 1px solid rgba(255, 255, 255, 0.07);
    padding: 0.45rem 0.55rem;
    cursor: pointer;
  }

  .font-face-row.active {
    border-color: rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.055);
  }

  .font-face-row input {
    flex: 0 0 auto;
  }

  .font-face-row span {
    flex: 1 1 auto;
    min-width: 0;
  }

  .font-picker-add {
    min-height: 2.15rem;
    border: 1px solid rgba(255, 255, 255, 0.12);
    background: rgba(255, 255, 255, 0.06);
    color: var(--text-bright);
    cursor: pointer;
    font-family: var(--font-ui);
    letter-spacing: 0.12em;
    text-transform: uppercase;
  }

  .font-picker-add:disabled {
    cursor: not-allowed;
    opacity: 0.5;
  }

  .font-picker-empty {
    padding: 0.8rem;
    color: var(--text-dim);
    font-size: 0.8rem;
  }

  @media (max-width: 640px) {
    .style-tool-grid {
      grid-template-columns: 1fr;
    }

    .font-picker-body {
      grid-template-columns: 1fr;
    }

    .font-filter-segments {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }
</style>
