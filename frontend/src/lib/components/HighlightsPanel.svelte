<script lang="ts">
  import type { HighlightRule } from '../types';
  import { getWorldHighlightsPanelId } from '../world-dom';

  export let open = false;
  export let highlight: HighlightRule | null = null;
  export let index = 0;
  export let scope = 'world';
  export let onUpdatePattern: (index: number, pattern: string) => void;
  export let onUpdateColor: (index: number, color: string) => void;
  export let onToggleCaseSensitive: (index: number) => void;
  export let onToggleWordBoundary: (index: number) => void;
  export let onDelete: (index: number) => void;
</script>

<div class="highlights-panel" id={getWorldHighlightsPanelId(scope)} class:open={open}>
  <div class="panel-header">
    <div class="panel-header-group">
      <div class="highlights-label">highlight</div>
      <div class="highlights-title">{highlight?.pattern || `highlight ${index + 1}`}</div>
    </div>
  </div>

  {#if highlight}
    <div class="highlight-editor">
      <div class="highlight-row">
        <input
          class="highlight-swatch-input"
          type="color"
          value={highlight.color}
          aria-label="Highlight color"
          title="Highlight color: click to open the color picker and change the rule color."
          on:change={(event) => onUpdateColor(index, (event.currentTarget as HTMLInputElement).value)}
        />
        <button
          type="button"
          class={`btn highlight-toggle${highlight.caseSensitive ? ' active' : ''}`}
          title="Case sensitive: match uppercase and lowercase exactly as typed."
          aria-pressed={highlight.caseSensitive}
          on:click={() => onToggleCaseSensitive(index)}
        >
          case
        </button>
        <button
          type="button"
          class={`btn highlight-toggle${highlight.wordBoundary ? ' active' : ''}`}
          title="Word boundary: only match the text as a standalone word."
          aria-pressed={highlight.wordBoundary}
          on:click={() => onToggleWordBoundary(index)}
        >
          word
        </button>
        <input
          class="highlight-pattern-input"
          type="text"
          value={highlight.pattern}
          autocomplete="off"
          spellcheck="false"
          aria-label="Highlight text"
          on:keydown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              (event.currentTarget as HTMLInputElement).blur();
            }
          }}
          on:blur={(event) => onUpdatePattern(index, (event.currentTarget as HTMLInputElement).value)}
        />
        <button type="button" class="btn danger" on:click={() => onDelete(index)}>del</button>
      </div>
    </div>
  {/if}
</div>
