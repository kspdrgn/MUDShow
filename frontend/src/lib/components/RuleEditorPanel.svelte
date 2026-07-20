<script lang="ts">
  import StyleSlideToggle from './StyleSlideToggle.svelte';
  import type { RuleDraft } from '../types';

  const DEFAULT_SAMPLE_TEXT = 'sample text to test the rule\ntry adding anchors like ^ and $';

  export let title = 'rule editor';
  export let draft: RuleDraft = {
    label: '',
    pattern: '',
    foregroundColor: '#f1c40f',
    foregroundColorEnabled: true,
    backgroundColor: '#000000',
    backgroundColorEnabled: true,
    opacity: 1,
    opacityEnabled: true,
    wholeLine: false,
    caseSensitive: false,
    sampleText: DEFAULT_SAMPLE_TEXT,
  };

  export let onCancel: () => void;
  export let onSave: (draft: RuleDraft) => void;
  export let onDelete: (() => void) | null = null;

  let pattern = '';
  let foregroundColor = '#f1c40f';
  let foregroundColorEnabled = true;
  let backgroundColor = '#000000';
  let backgroundColorEnabled = true;
  let opacity = 1;
  let opacityEnabled = true;
  let wholeLine = false;
  let caseSensitive = false;
  let sampleText = DEFAULT_SAMPLE_TEXT;
  let label = '';
  let lastSnapshot = '';
  let lastOpen = false;
  let validationError = '';
  let sampleMirrorHtml = '';
  let saveDisabled = true;

  function escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function compilePattern(): RegExp | null {
    const trimmed = pattern.trim();
    if (!trimmed) {
      validationError = 'enter a regexp pattern';
      return null;
    }

    try {
      return new RegExp(trimmed, caseSensitive ? 'gm' : 'gim');
    } catch (error) {
      validationError = error instanceof Error ? error.message : 'invalid regexp';
      return null;
    }
  }

  function buildSampleMirror(regex: RegExp): void {
    let result = '';
    let lastIndex = 0;
    let matchCount = 0;

    for (const match of sampleText.matchAll(regex)) {
      const index = match.index ?? lastIndex;
      const matched = match[0];

      if (index < lastIndex) {
        continue;
      }

      result += escapeHtml(sampleText.slice(lastIndex, index));
      if (matched.length === 0) {
        result += '<span class="rule-preview-zero-width">∅</span>';
        lastIndex = Math.min(sampleText.length, index + 1);
        matchCount += 1;
        continue;
      }

      result += `<span class="rule-preview-hit">${escapeHtml(matched)}</span>`;
      lastIndex = index + matched.length;
      matchCount += 1;
    }

    result += escapeHtml(sampleText.slice(lastIndex));
    sampleMirrorHtml = result.replace(/\n/g, '<br>');
  }

  function refreshSampleMirror(): void {
    validationError = '';
    sampleMirrorHtml = '';

    const regex = compilePattern();
    saveDisabled = regex === null;
    if (!regex) {
      sampleMirrorHtml = escapeHtml(sampleText).replace(/\n/g, '<br>');
      return;
    }

    buildSampleMirror(regex);
    saveDisabled = false;
  }

  $: {
    const snapshot = JSON.stringify(draft);
    if (snapshot !== lastSnapshot || !lastOpen) {
      pattern = draft.pattern;
      foregroundColor = draft.foregroundColor;
      foregroundColorEnabled = draft.foregroundColorEnabled;
      backgroundColor = draft.backgroundColor;
      backgroundColorEnabled = draft.backgroundColorEnabled;
      opacity = draft.opacity;
      opacityEnabled = draft.opacityEnabled;
      wholeLine = draft.wholeLine;
      caseSensitive = draft.caseSensitive;
      sampleText = draft.sampleText || DEFAULT_SAMPLE_TEXT;
      label = draft.label ?? '';
      lastSnapshot = snapshot;
      refreshSampleMirror();
    }

    lastOpen = true;
  }

  function handleSave(): void {
    const trimmedPattern = pattern.trim();
    if (!trimmedPattern || saveDisabled) {
      return;
    }

    onSave({
      label: label.trim(),
      pattern: trimmedPattern,
      foregroundColor,
      foregroundColorEnabled,
      backgroundColor,
      backgroundColorEnabled,
      opacity,
      opacityEnabled,
      wholeLine,
      caseSensitive,
      sampleText,
    });
  }

  function activateForegroundColor(): void {
    foregroundColorEnabled = true;
  }

  function activateBackgroundColor(): void {
    backgroundColorEnabled = true;
  }

  function activateOpacity(): void {
    opacityEnabled = true;
  }

  function handleDelete(): void {
    onDelete?.();
  }
</script>

<div class="rule-editor-panel">
  <div class="rule-editor-header">
    <div>
      <h2>{title}</h2>
      <p class="settings-note">rules use regular expression matching for advanced styling and later routing behaviors.</p>
    </div>
  </div>

  <form class="rule-editor-form" on:submit|preventDefault={handleSave}>
    <div class="rule-editor-scroll">
      <div class="field">
        <label for="rule-label">label</label>
        <input
          id="rule-label"
          bind:value={label}
          autocomplete="off"
          spellcheck="false"
          placeholder="organization label"
        />
      </div>

      <div class="field">
        <label for="rule-pattern">regexp pattern</label>
        <textarea
          id="rule-pattern"
          rows="3"
          bind:value={pattern}
          autocomplete="off"
          spellcheck="false"
          placeholder="^page:"
          on:input={refreshSampleMirror}
        ></textarea>
      </div>

      <div class="field">
        <label for="rule-sample-text">test text</label>
        <textarea
          id="rule-sample-text"
          rows="5"
          bind:value={sampleText}
          spellcheck="false"
          placeholder="paste some transcript text here"
          on:input={refreshSampleMirror}
        ></textarea>
        <div class="rule-preview-label">preview</div>
        <div
          class="rule-sample-preview"
          aria-label="test text preview"
          style:--rule-preview-foreground={foregroundColorEnabled ? foregroundColor : 'inherit'}
          style:--rule-preview-background={backgroundColorEnabled ? backgroundColor : 'rgba(241, 196, 15, 0.28)'}
          style:--rule-preview-opacity={opacityEnabled ? opacity : 1}
        >
          {@html sampleMirrorHtml}
        </div>
        {#if validationError}
          <div class="rule-preview-error">{validationError}</div>
        {/if}
      </div>

      <div class="rule-section-grid">
        <fieldset class="rule-group rule-actions-group">
          <legend>actions</legend>

          <section class="rule-action-card" data-disabled={!foregroundColorEnabled}>
            <div class="rule-action-header">
              <label for="rule-foreground-color">foreground color</label>
              <StyleSlideToggle
                checked={foregroundColorEnabled}
                ariaLabel="Toggle foreground color"
                title={foregroundColorEnabled ? 'Disable foreground color' : 'Enable foreground color'}
                on:change={(event) => {
                  foregroundColorEnabled = event.detail;
                }}
              />
            </div>
            <div class="rule-action-body">
              <input
                id="rule-foreground-color"
                type="color"
                bind:value={foregroundColor}
                on:pointerdown={activateForegroundColor}
                on:focus={activateForegroundColor}
                on:input={() => {
                  activateForegroundColor();
                  refreshSampleMirror();
                }}
              />
            </div>
          </section>

          <section class="rule-action-card" data-disabled={!backgroundColorEnabled}>
            <div class="rule-action-header">
              <label for="rule-background-color">background color</label>
              <StyleSlideToggle
                checked={backgroundColorEnabled}
                ariaLabel="Toggle background color"
                title={backgroundColorEnabled ? 'Disable background color' : 'Enable background color'}
                on:change={(event) => {
                  backgroundColorEnabled = event.detail;
                }}
              />
            </div>
            <div class="rule-action-body">
              <input
                id="rule-background-color"
                type="color"
                bind:value={backgroundColor}
                on:pointerdown={activateBackgroundColor}
                on:focus={activateBackgroundColor}
                on:input={() => {
                  activateBackgroundColor();
                  refreshSampleMirror();
                }}
              />
            </div>
          </section>

          <section class="rule-action-card" data-disabled={!opacityEnabled}>
            <div class="rule-action-header">
              <label for="rule-opacity">opacity</label>
              <StyleSlideToggle
                checked={opacityEnabled}
                ariaLabel="Toggle opacity"
                title={opacityEnabled ? 'Disable opacity' : 'Enable opacity'}
                on:change={(event) => {
                  opacityEnabled = event.detail;
                }}
              />
            </div>
            <div class="rule-action-body">
              <input
                id="rule-opacity"
                type="number"
                min="0"
                max="1"
                step="0.01"
                bind:value={opacity}
                readonly={!opacityEnabled}
                on:pointerdown={activateOpacity}
                on:focus={activateOpacity}
                on:input={() => {
                  activateOpacity();
                  refreshSampleMirror();
                }}
              />
            </div>
          </section>
        </fieldset>

        <fieldset class="rule-group">
          <legend>match behavior</legend>

          <div class="field field-check">
            <label for="rule-whole-line">
              <input
                id="rule-whole-line"
                type="checkbox"
                bind:checked={wholeLine}
                on:change={refreshSampleMirror}
              />
              whole line
            </label>
          </div>

          <div class="field field-check">
            <label for="rule-case-sensitive">
              <input
                id="rule-case-sensitive"
                type="checkbox"
                bind:checked={caseSensitive}
                on:change={refreshSampleMirror}
              />
              case sensitive
            </label>
          </div>
        </fieldset>
      </div>

      <fieldset class="rule-group">
        <legend>regexp cheatsheet</legend>
        <div class="rule-cheatsheet">
          <div><code>^</code> start of line</div>
          <div><code>$</code> end of line</div>
          <div><code>.</code> any character</div>
          <div><code>.*</code> anything in between</div>
          <div><code>(a|b)</code> one of two choices</div>
          <div><code>\bword\b</code> whole word match</div>
        </div>
      </fieldset>
    </div>

    <div class="rule-editor-actions">
      {#if onDelete}
        <button class="btn danger" type="button" on:click={handleDelete}>delete</button>
      {/if}
      <div class="rule-editor-actions-spacer"></div>
      <button class="btn" type="button" on:click={onCancel}>cancel</button>
      <button class="btn primary" type="submit" disabled={saveDisabled}>save</button>
    </div>
  </form>
</div>

<style>
  .rule-editor-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.9rem;
    min-height: 0;
    height: 100%;
    flex: 1 1 auto;
    overflow: hidden;
  }

  .rule-editor-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .rule-editor-header h2 {
    margin: 0;
  }

  .rule-editor-form {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
  }

  .rule-editor-scroll {
    min-height: 0;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .rule-section-grid {
    display: grid;
    gap: 0.9rem;
  }

  .rule-group {
    margin: 0;
    padding: 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.015);
    display: grid;
    gap: 0.75rem;
  }

  .rule-actions-group {
    grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
    gap: 0.55rem;
  }

  .rule-actions-group legend {
    grid-column: 1 / -1;
  }

  .rule-group legend {
    padding: 0 0.35rem;
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .rule-action-card {
    display: flex;
    flex-direction: column;
    gap: 0.42rem;
    min-width: 0;
    padding: 0.55rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .rule-action-card[data-disabled='true'] {
    opacity: 0.55;
  }

  .rule-action-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .rule-action-header label {
    min-width: 0;
    font-size: 0.78rem;
    line-height: 1.25;
    text-transform: lowercase;
  }

  .rule-action-body {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .rule-action-body input[type='color'] {
    width: 2.4rem;
    height: 1.75rem;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .rule-action-body input[type='number'] {
    width: 5.25rem;
    padding-block: 0.42rem;
    padding-inline: 0.55rem;
  }

  .rule-preview-label {
    margin-top: 0.65rem;
    font-family: var(--font-ui);
    font-size: 0.72rem;
    letter-spacing: 0.15em;
    line-height: 1.25;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .rule-sample-preview {
    box-sizing: border-box;
    min-height: 6rem;
    max-height: 18rem;
    overflow: auto;
    margin-top: 0.35rem;
    padding: 0.85rem 0.95rem;
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 0.55rem;
    background: rgba(255, 255, 255, 0.025);
    font: inherit;
    line-height: 1.45;
    white-space: pre-wrap;
    word-break: break-word;
  }

  :global(.rule-sample-preview .rule-preview-hit) {
    border-radius: 0.25rem;
    background: var(--rule-preview-background);
    color: var(--rule-preview-foreground);
    opacity: var(--rule-preview-opacity);
    box-shadow: 0 0 0 1px rgba(241, 196, 15, 0.35) inset;
  }

  :global(.rule-sample-preview .rule-preview-zero-width) {
    color: #f39c12;
    font-weight: 700;
  }

  .rule-preview-error {
    color: #ff8a8a;
    font-size: 0.9rem;
  }

  .rule-editor-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.85rem;
    padding: 0.85rem 0 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .rule-editor-actions-spacer {
    flex: 1 1 auto;
  }
</style>
