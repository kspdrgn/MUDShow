<script lang="ts">
  import { onMount } from 'svelte';
  import { applyHighlights, buildHighlightRegexes, renderTranscriptHtml } from '../formatting';
  import { copyTextToClipboard, focusElement, nextFrame, scrollElementToBottom } from '../session-dom';
  import { openExternalUrl } from '../tauri';
  import { getScopedInputBarInputId, type InputBarId } from '../input-bars';
  import type { HighlightRule } from '../types';

  const IMAGE_PREVIEW_DIAGNOSTICS_ENABLED = false;

  export let activeBar: InputBarId = 1;
  export let chunks: string[] = [];
  export let width = 'none';
  export let scope = 'world';
  export let highlights: HighlightRule[] = [];
  export let linkImagePreviews = false;
  export let userScrolled = false;
  export let onScroll: () => void;
  export let onScrollToBottom: () => void;

  let outputArea: HTMLDivElement | null = null;
  let highlightRegexes = buildHighlightRegexes(highlights);
  let renderedChunks: string[] = [];

  $: highlightRegexes = buildHighlightRegexes(highlights);
  $: renderedChunks = chunks.map((chunk) =>
    applyHighlights(renderTranscriptHtml(chunk, linkImagePreviews), highlightRegexes),
  );

  async function handleMouseUp(): Promise<void> {
    const selection = window.getSelection();
    const text = selection?.toString() ?? '';

    if (text.trim()) {
      try {
        await copyTextToClipboard(text);
      } finally {
        focusElement(getScopedInputBarInputId(scope, activeBar));
      }
      return;
    }

    focusElement(getScopedInputBarInputId(scope, activeBar));
  }

  async function handleClick(event: MouseEvent): Promise<void> {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const anchor = target.closest('a.output-link');
    if (!(anchor instanceof HTMLAnchorElement)) {
      return;
    }

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      event.preventDefault();
      return;
    }

    event.preventDefault();
    try {
      await openExternalUrl(anchor.href);
    } finally {
      focusElement(getScopedInputBarInputId(scope, activeBar));
    }
  }

  function handlePreviewLoad(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    const previewUrl = target.getAttribute('data-preview-url') ?? target.currentSrc ?? target.src;
    if (IMAGE_PREVIEW_DIAGNOSTICS_ENABLED) {
      console.info('[MUDShow] image preview loaded', {
        url: previewUrl,
        naturalWidth: target.naturalWidth,
        naturalHeight: target.naturalHeight,
        currentSrc: target.currentSrc || target.src,
        hostElement: target.parentElement?.tagName.toLowerCase() ?? 'img',
      });
    }

    if (userScrolled) {
      return;
    }

    void nextFrame().then(() => {
      if (!userScrolled) {
        scrollElementToBottom(`${scope}-output-area`);
      }
    });
  }

  function handlePreviewError(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    const previewUrl = target.getAttribute('data-preview-url') ?? target.currentSrc ?? target.src;
    if (IMAGE_PREVIEW_DIAGNOSTICS_ENABLED) {
      console.warn('[MUDShow] image preview failed to load', {
        url: previewUrl,
        currentSrc: target.currentSrc || target.src,
        complete: target.complete,
        naturalWidth: target.naturalWidth,
        naturalHeight: target.naturalHeight,
      });
    }
  }

  function handleScrollToBottomClick(): void {
    onScrollToBottom();
  }

  onMount(() => {
    const node = outputArea;

    if (!node) {
      return undefined;
    }

    node.addEventListener('mouseup', handleMouseUp);
    node.addEventListener('click', handleClick);
    node.addEventListener('load', handlePreviewLoad, true);
    node.addEventListener('error', handlePreviewError, true);

    return () => {
      node.removeEventListener('mouseup', handleMouseUp);
      node.removeEventListener('click', handleClick);
      node.removeEventListener('load', handlePreviewLoad, true);
      node.removeEventListener('error', handlePreviewError, true);
    };
  });
</script>

<div class="output-transcript-shell" style={`--play-width: ${width};`}>
  <div
    bind:this={outputArea}
    class="output-area"
    id={`${scope}-output-area`}
    role="region"
    aria-label="Transcript output"
    on:scroll={onScroll}
  >
    {#each renderedChunks as renderedChunk}
      <div class="output-chunk">{@html renderedChunk}</div>
    {/each}
  </div>

  {#if userScrolled}
    <button
      type="button"
      class="output-scroll-bottom-button"
      aria-label="Scroll to bottom"
      on:click={handleScrollToBottomClick}
    >
      ↓
    </button>
  {/if}
</div>
