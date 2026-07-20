<script lang="ts">
  import StyleSlideToggle from '../styles/StyleSlideToggle.svelte';
  import type { HighlightDraft } from '../../types';
  import { getWorldHighlightsPanelId } from '../../world-dom';

  export let open = false;
  export let title = 'highlight editor';
  export let draft: HighlightDraft = {
    pattern: '',
    foregroundColor: '#ffffff',
    foregroundColorEnabled: true,
    backgroundColor: '#000000',
    backgroundColorEnabled: true,
    caseSensitive: false,
    wordBoundary: true,
  };
  export let scope = 'world';
  export let onCancel: () => void;
  export let onSave: (draft: HighlightDraft) => void;
  export let onDelete: (() => void) | null = null;

  let pattern = '';
  let foregroundColor = '#ffffff';
  let foregroundColorEnabled = true;
  let backgroundColor = '#000000';
  let backgroundColorEnabled = true;
  let caseSensitive = false;
  let wordBoundary = true;
  let lastSnapshot = '';
  let lastOpen = false;

  $: {
    const snapshot = JSON.stringify(draft);
    if (snapshot !== lastSnapshot || !lastOpen) {
      pattern = draft.pattern;
      foregroundColor = draft.foregroundColor;
      foregroundColorEnabled = draft.foregroundColorEnabled;
      backgroundColor = draft.backgroundColor;
      backgroundColorEnabled = draft.backgroundColorEnabled;
      caseSensitive = draft.caseSensitive;
      wordBoundary = draft.wordBoundary;
      lastSnapshot = snapshot;
    }

    lastOpen = open;
  }

  function handleSave(): void {
    const trimmedPattern = pattern.trim();
    if (!trimmedPattern) {
      return;
    }

    onSave({
      pattern: trimmedPattern,
      foregroundColor,
      foregroundColorEnabled,
      backgroundColor,
      backgroundColorEnabled,
      caseSensitive,
      wordBoundary,
    });
  }

  function activateForegroundColor(): void {
    foregroundColorEnabled = true;
  }

  function activateBackgroundColor(): void {
    backgroundColorEnabled = true;
  }
</script>

<div class="highlight-editor-panel" id={getWorldHighlightsPanelId(scope)} class:open={open}>
  <div class="highlight-editor-header">
    <div>
      <h2>{title}</h2>
      <p class="settings-note">highlights are for styling words or phrases.</p>
    </div>
  </div>

  {#if draft}
    <form class="highlight-editor-form" on:submit|preventDefault={handleSave}>
      <div class="highlight-editor-scroll">
        <div class="field">
          <label for="highlight-pattern">text</label>
          <input
            id="highlight-pattern"
            bind:value={pattern}
            autocomplete="off"
            spellcheck="false"
            placeholder="highlight text"
          />
        </div>

        <div class="highlight-section-grid">
          <fieldset class="highlight-group highlight-actions-group">
            <legend>actions</legend>

            <section class="highlight-action-card" data-disabled={!foregroundColorEnabled}>
              <div class="highlight-action-header">
                <label for="highlight-foreground-color">foreground color</label>
                <StyleSlideToggle
                  checked={foregroundColorEnabled}
                  ariaLabel="Toggle foreground color"
                  title={foregroundColorEnabled ? 'Disable foreground color' : 'Enable foreground color'}
                  on:change={(event) => {
                    foregroundColorEnabled = event.detail;
                  }}
                />
              </div>
              <div class="highlight-action-body">
                <input
                  id="highlight-foreground-color"
                  type="color"
                  bind:value={foregroundColor}
                  aria-label="Highlight foreground color"
                  on:pointerdown={activateForegroundColor}
                  on:focus={activateForegroundColor}
                  on:input={activateForegroundColor}
                />
              </div>
            </section>

            <section class="highlight-action-card" data-disabled={!backgroundColorEnabled}>
              <div class="highlight-action-header">
                <label for="highlight-background-color">background color</label>
                <StyleSlideToggle
                  checked={backgroundColorEnabled}
                  ariaLabel="Toggle background color"
                  title={backgroundColorEnabled ? 'Disable background color' : 'Enable background color'}
                  on:change={(event) => {
                    backgroundColorEnabled = event.detail;
                  }}
                />
              </div>
              <div class="highlight-action-body">
                <input
                  id="highlight-background-color"
                  type="color"
                  bind:value={backgroundColor}
                  aria-label="Highlight background color"
                  on:pointerdown={activateBackgroundColor}
                  on:focus={activateBackgroundColor}
                  on:input={activateBackgroundColor}
                />
              </div>
            </section>
          </fieldset>

          <fieldset class="highlight-group">
            <legend>match behavior</legend>

            <div class="field field-check">
              <label for="highlight-case-sensitive">
                <input id="highlight-case-sensitive" type="checkbox" bind:checked={caseSensitive} />
                case sensitive
              </label>
            </div>

            <div class="field field-check">
              <label for="highlight-word-boundary">
                <input id="highlight-word-boundary" type="checkbox" bind:checked={wordBoundary} />
                word
              </label>
            </div>
          </fieldset>
        </div>
      </div>

      <div class="highlight-editor-actions">
        {#if onDelete}
          <button class="btn danger" type="button" on:click={() => onDelete?.()}>delete</button>
        {/if}
        <div class="highlight-editor-actions-spacer"></div>
        <button class="btn" type="button" on:click={onCancel}>cancel</button>
        <button class="btn primary" type="submit" disabled={!pattern.trim()}>save</button>
      </div>
    </form>
  {/if}
</div>

<style>
  .highlight-editor-panel {
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
    gap: 0.9rem;
    min-height: 0;
    height: 100%;
    flex: 1 1 auto;
    overflow: hidden;
  }

  .highlight-editor-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .highlight-editor-header h2 {
    margin: 0;
  }

  .highlight-editor-form {
    display: grid;
    grid-template-rows: minmax(0, 1fr) auto;
    min-height: 0;
  }

  .highlight-editor-scroll {
    min-height: 0;
    overflow-y: auto;
    padding-right: 0.25rem;
  }

  .highlight-section-grid {
    display: grid;
    gap: 0.9rem;
  }

  .highlight-group {
    margin: 0;
    padding: 0.85rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.015);
    display: grid;
    gap: 0.75rem;
  }

  .highlight-actions-group {
    grid-template-columns: repeat(auto-fit, minmax(10.5rem, 1fr));
    gap: 0.55rem;
  }

  .highlight-actions-group legend {
    grid-column: 1 / -1;
  }

  .highlight-group legend {
    padding: 0 0.35rem;
    font-family: var(--font-ui);
    font-size: 0.68rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--text-dim);
  }

  .highlight-action-card {
    display: flex;
    flex-direction: column;
    gap: 0.42rem;
    min-width: 0;
    padding: 0.55rem 0.6rem;
    border: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .highlight-action-card[data-disabled='true'] {
    opacity: 0.55;
  }

  .highlight-action-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .highlight-action-header label {
    min-width: 0;
    font-size: 0.78rem;
    line-height: 1.25;
    text-transform: lowercase;
  }

  .highlight-action-body {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .highlight-action-body input[type='color'] {
    width: 2.4rem;
    height: 1.75rem;
    padding: 0;
    border: 0;
    background: transparent;
    cursor: pointer;
  }

  .highlight-editor-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-top: 0.85rem;
    padding: 0.85rem 0 0;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    background: rgba(255, 255, 255, 0.02);
  }

  .highlight-editor-actions-spacer {
    flex: 1 1 auto;
  }
</style>
