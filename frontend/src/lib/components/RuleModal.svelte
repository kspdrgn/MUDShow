<script lang="ts">
  import { tick } from 'svelte';
  import type { RuleDraft } from '../types';

  const DEFAULT_SAMPLE_TEXT = 'sample text to test the rule\ntry adding anchors like ^ and $';

  export let open = false;
  export let title = 'rule editor';
  export let draft: RuleDraft = {
    pattern: '',
    color: '#f1c40f',
    caseSensitive: false,
    sampleText: DEFAULT_SAMPLE_TEXT,
  };

  export let onCancel: () => void;
  export let onSave: (draft: RuleDraft) => void;

  let pattern = '';
  let color = '#f1c40f';
  let caseSensitive = false;
  let sampleText = DEFAULT_SAMPLE_TEXT;
  let lastSnapshot = '';
  let lastOpen = false;
  let validationError = '';
  let previewHtml = '';
  let previewMatchCount = 0;
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

  function buildPreview(regex: RegExp): void {
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
        continue;
      }

      result += `<span class="rule-preview-hit">${escapeHtml(matched)}</span>`;
      matchCount += 1;
      lastIndex = index + matched.length;
    }

    result += escapeHtml(sampleText.slice(lastIndex));
    previewHtml = result.replace(/\n/g, '<br>');
    previewMatchCount = matchCount;
  }

  function refreshPreview(): void {
    validationError = '';
    previewHtml = '';
    previewMatchCount = 0;

    const regex = compilePattern();
    saveDisabled = regex === null;
    if (!regex) {
      return;
    }

    buildPreview(regex);
    saveDisabled = false;
  }

  $: {
    const snapshot = JSON.stringify(draft);
    if (open && (!lastOpen || snapshot !== lastSnapshot)) {
      pattern = draft.pattern;
      color = draft.color;
      caseSensitive = draft.caseSensitive;
      sampleText = draft.sampleText || DEFAULT_SAMPLE_TEXT;
      lastSnapshot = snapshot;
      void tick().then(() => {
        refreshPreview();
      });
    }

    lastOpen = open;
  }

  function handleSave(): void {
    const trimmedPattern = pattern.trim();
    if (!trimmedPattern || saveDisabled) {
      return;
    }

    onSave({
      pattern: trimmedPattern,
      color: color.trim() || '#f1c40f',
      caseSensitive,
      sampleText,
    });
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
          <label for="rule-pattern">regexp pattern</label>
          <textarea
            id="rule-pattern"
            rows="3"
            bind:value={pattern}
            autocomplete="off"
            spellcheck="false"
            placeholder="^page:"
            autofocus
            on:input={refreshPreview}
          ></textarea>
        </div>

        <div class="field">
          <label for="rule-color">color</label>
          <input id="rule-color" type="color" bind:value={color} on:input={refreshPreview} />
        </div>

        <div class="field field-check">
          <label for="rule-case-sensitive">
            <input
              id="rule-case-sensitive"
              type="checkbox"
              bind:checked={caseSensitive}
              on:change={refreshPreview}
            />
            case sensitive
          </label>
        </div>

        <div class="field">
          <label for="rule-sample-text">test text</label>
          <textarea
            id="rule-sample-text"
            rows="5"
            bind:value={sampleText}
            spellcheck="false"
            placeholder="paste some transcript text here"
            on:input={refreshPreview}
          ></textarea>
        </div>

        <div class="field">
          <label>preview</label>
          <div class="rule-preview" aria-live="polite">
            {#if validationError}
              <div class="rule-preview-error">{validationError}</div>
            {:else}
              <div class="rule-preview-summary">
                {previewMatchCount === 1 ? '1 match' : `${previewMatchCount} matches`}
              </div>
              <div class="rule-preview-body">{@html previewHtml}</div>
            {/if}
          </div>
        </div>

        <div class="field">
          <label>regexp cheatsheet</label>
          <div class="rule-cheatsheet">
            <div><code>^</code> start of line</div>
            <div><code>$</code> end of line</div>
            <div><code>.</code> any character</div>
            <div><code>.*</code> anything in between</div>
            <div><code>(a|b)</code> one of two choices</div>
            <div><code>\bword\b</code> whole word match</div>
          </div>
        </div>

        <div class="modal-actions">
          <button class="btn" type="button" on:click={onCancel}>cancel</button>
          <button class="btn primary" type="submit" disabled={saveDisabled}>save</button>
        </div>
      </form>
    </div>
  </div>
{/if}
