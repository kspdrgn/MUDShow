<script lang="ts">
  import { tick } from 'svelte';
  import StyleSlideToggle from './StyleSlideToggle.svelte';
  import type { RuleDraft } from '../types';

  const DEFAULT_SAMPLE_TEXT = 'sample text to test the rule\ntry adding anchors like ^ and $';

  export let open = false;
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
  let sampleTextArea: HTMLTextAreaElement | null = null;
  let sampleMirrorElement: HTMLDivElement | null = null;
  let sampleMirrorSyncToken = 0;

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
        continue;
      }

      result += `<span class="rule-preview-hit">${escapeHtml(matched)}</span>`;
      lastIndex = index + matched.length;
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

  function syncSampleMirrorScroll(): void {
    if (!sampleTextArea || !sampleMirrorElement) {
      return;
    }

    sampleMirrorElement.scrollTop = sampleTextArea.scrollTop;
    sampleMirrorElement.scrollLeft = sampleTextArea.scrollLeft;
  }

  function scheduleSampleMirrorScrollSync(): void {
    const token = ++sampleMirrorSyncToken;

    void tick().then(() => {
      if (!open || token !== sampleMirrorSyncToken) {
        return;
      }

      requestAnimationFrame(() => {
        if (!open || token !== sampleMirrorSyncToken) {
          return;
        }

        syncSampleMirrorScroll();
      });
    });
  }

  $: {
    const snapshot = JSON.stringify(draft);
    if (open && (!lastOpen || snapshot !== lastSnapshot)) {
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
      scheduleSampleMirrorScrollSync();
    }

    lastOpen = open;
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

  function handleOverlayKeyDown(event: KeyboardEvent): void {
    if (event.currentTarget !== event.target) {
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onCancel();
    }
  }
</script>

{#if open}
  <div
    id="modal-overlay"
    class="open"
    role="button"
    tabindex="0"
    aria-label="close rule editor"
    on:pointerdown|self={onCancel}
    on:keydown={handleOverlayKeyDown}
  >
    <div id="modal" class="rule-modal">
      <button
        type="button"
        class="btn logging-modal-close"
        aria-label="Close rule editor"
        title="Close rule editor"
        on:click={onCancel}
      >
        X
      </button>

      <h2>{title}</h2>
      <p class="settings-note">raw regexp rules are for advanced matching and later routing behaviors.</p>

      <form on:submit|preventDefault={handleSave}>
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
            autofocus
            on:input={refreshSampleMirror}
          ></textarea>
        </div>

        <div class="field">
          <label for="rule-sample-text">test text</label>
          <div class="rule-sample-surface">
            <div class="rule-sample-mirror" bind:this={sampleMirrorElement} aria-hidden="true">
              {@html sampleMirrorHtml}
            </div>
            <textarea
              id="rule-sample-text"
              class="rule-sample-input"
              rows="5"
              bind:this={sampleTextArea}
              bind:value={sampleText}
              spellcheck="false"
              placeholder="paste some transcript text here"
              on:input={() => {
                refreshSampleMirror();
                scheduleSampleMirrorScrollSync();
              }}
              on:scroll={syncSampleMirrorScroll}
            ></textarea>
          </div>
          {#if validationError}
            <div class="rule-preview-error">{validationError}</div>
          {/if}
        </div>

        <div class="rule-section-grid">
          <fieldset class="rule-group">
            <legend>actions</legend>

            <section class="rule-action-card" aria-disabled={!foregroundColorEnabled}>
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

            <section class="rule-action-card" aria-disabled={!backgroundColorEnabled}>
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

            <section class="rule-action-card" aria-disabled={!opacityEnabled}>
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

        <div class="modal-actions">
          <button class="btn" type="button" on:click={onCancel}>cancel</button>
          <button class="btn primary" type="submit" disabled={saveDisabled}>save</button>
        </div>
      </form>
    </div>
  </div>
{/if}

<style>
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
    gap: 0.55rem;
    padding: 0.72rem 0.8rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .rule-action-card[aria-disabled='true'] {
    opacity: 0.55;
  }

  .rule-action-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .rule-action-header label {
    font-size: 0.88rem;
    text-transform: lowercase;
  }

  .rule-action-body {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .rule-action-body input[type='color'] {
    width: 3rem;
    height: 2rem;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .rule-action-body input[type='number'] {
    width: 7rem;
  }

  .rule-checkbox {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }
</style>
