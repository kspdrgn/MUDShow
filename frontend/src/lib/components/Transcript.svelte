<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { applyHighlights, buildHighlightRegexes, renderTranscriptHtml } from '../formatting';
  import {
    copyTextToClipboard,
    focusElement,
    nextFrame,
    scrollElementBy,
    scrollElementToBottom,
  } from '../session-dom';
  import { openExternalUrl } from '../tauri';
  import { getScopedInputBarInputId, type InputBarId } from '../input-bars';
  import type { HighlightRule } from '../types';
  import WorldContextMenu from './WorldContextMenu.svelte';

  const IMAGE_PREVIEW_DIAGNOSTICS_ENABLED = import.meta.env.DEV;

  export let activeBar: InputBarId = 1;
  export let chunks: string[] = [];
  export let width = 'none';
  export let scope = 'world';
  export let highlights: HighlightRule[] = [];
  export let linkImagePreviews = false;
  export let imagePreviewCacheVersion = 0;
  export let showCurrentOutputWhenScrollingUp = true;
  export let userScrolled = false;
  export let canReconnect = false;
  export let canDisconnect = false;
  export let canQuickLog = false;
  export let canStopLogging = false;
  export let canEditWorld = false;
  export let canEditCharacter = false;
  export let onReconnect: () => void;
  export let onDisconnect: () => void;
  export let onQuickLog: () => void;
  export let onStopLogging: () => void;
  export let onOpenLogging: () => void;
  export let onEditWorld: () => void;
  export let onEditCharacter: () => void;
  export let onOpenNotes: () => void;
  export let onOpenHighlights: () => void;
  export let onCloseRequest: (anchorRect: DOMRect) => void;
  export let onScroll: () => void;
  export let onScrollToBottom: () => void;

  let highlightRegexes = buildHighlightRegexes(highlights);
  let renderedChunks: string[] = [];
  let liveRenderedChunks: string[] = [];
  let splitView = false;
  let hiddenPreviewUrls = new Set<string>();
  let transcriptShellElement: HTMLDivElement | null = null;
  let transcriptContentElement: HTMLDivElement | null = null;
  let contextMenuOpen = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let contentResizeObserver: ResizeObserver | null = null;
  let userScrollIntent = false;

  function closeContextMenu(): void {
    contextMenuOpen = false;
  }

  $: highlightRegexes = buildHighlightRegexes(highlights);
  $: renderedChunks = chunks.map((chunk) =>
    applyHighlights(
      renderTranscriptHtml(chunk, linkImagePreviews, hiddenPreviewUrls, imagePreviewCacheVersion),
      highlightRegexes,
    ),
  );
  $: liveRenderedChunks = chunks.map((chunk) =>
    applyHighlights(renderTranscriptHtml(chunk, false), highlightRegexes),
  );
  $: splitView = showCurrentOutputWhenScrollingUp && userScrolled;

  function scrollTranscriptToBottomIfFollowing(): void {
    if (userScrolled) {
      return;
    }

    scrollElementToBottom(`${scope}-output-area`);
  }

  function getScrollMetrics(): {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    distanceFromBottom: number;
  } | null {
    const outputEl = document.getElementById(`${scope}-output-area`);
    if (!(outputEl instanceof HTMLElement)) {
      return null;
    }

    return {
      scrollTop: outputEl.scrollTop,
      scrollHeight: outputEl.scrollHeight,
      clientHeight: outputEl.clientHeight,
      distanceFromBottom: outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight,
    };
  }

  async function handleMouseUp(): Promise<void> {
    userScrollIntent = false;

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
    closeContextMenu();

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const dismissButton = target.closest('button[data-preview-dismiss]');
    if (dismissButton instanceof HTMLButtonElement) {
      const previewUrl = dismissButton.getAttribute('data-preview-url');
      if (previewUrl) {
        hiddenPreviewUrls = new Set(hiddenPreviewUrls).add(previewUrl);
      }
      event.preventDefault();
      event.stopPropagation();
      focusElement(getScopedInputBarInputId(scope, activeBar));
      return;
    }

    const toggleButton = target.closest('button[data-preview-toggle]');
    if (toggleButton instanceof HTMLButtonElement) {
      const previewUrl = toggleButton.getAttribute('data-preview-url');
      if (previewUrl) {
        const nextHiddenPreviewUrls = new Set(hiddenPreviewUrls);
        if (nextHiddenPreviewUrls.has(previewUrl)) {
          nextHiddenPreviewUrls.delete(previewUrl);
        } else {
          nextHiddenPreviewUrls.add(previewUrl);
        }
        hiddenPreviewUrls = nextHiddenPreviewUrls;
      }
      event.preventDefault();
      event.stopPropagation();
      focusElement(getScopedInputBarInputId(scope, activeBar));
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

    const previewItem = target.closest<HTMLElement>('.output-link-preview-item');
    const placeholder = previewItem?.querySelector<HTMLElement>('.output-link-preview-tombstone');
    const placeholderHeight = placeholder?.getBoundingClientRect().height ?? null;
    const imageHeightBeforeReveal = target.getBoundingClientRect().height;
    const scrollBefore = IMAGE_PREVIEW_DIAGNOSTICS_ENABLED ? getScrollMetrics() : null;

    if (previewItem) {
      previewItem.dataset.previewLoaded = 'true';
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

    if (IMAGE_PREVIEW_DIAGNOSTICS_ENABLED) {
      console.debug('[MUDShow] image preview load', {
        url: previewUrl,
        placeholderHeight,
        imageHeightBeforeReveal,
        scrollBefore,
        userScrolled,
      });
    }

    if (userScrolled) {
      return;
    }

    void nextFrame().then(() => {
      if (IMAGE_PREVIEW_DIAGNOSTICS_ENABLED) {
        console.debug('[MUDShow] image preview post-load', {
          url: previewUrl,
          imageHeightAfterReveal: target.getBoundingClientRect().height,
          previewHeightAfterReveal: previewItem?.getBoundingClientRect().height ?? null,
          scrollAfter: getScrollMetrics(),
          userScrolled,
        });
      }
      scrollTranscriptToBottomIfFollowing();
    });
  }

  function handlePreviewError(event: Event): void {
    const target = event.target;
    if (!(target instanceof HTMLImageElement)) {
      return;
    }

    const previewItem = target.closest<HTMLElement>('.output-link-preview-item');
    if (previewItem) {
      previewItem.dataset.previewLoaded = 'true';
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

    if (IMAGE_PREVIEW_DIAGNOSTICS_ENABLED) {
      console.debug('[MUDShow] image preview error', {
        url: previewUrl,
        previewHeight: previewItem?.getBoundingClientRect().height ?? null,
        scrollState: getScrollMetrics(),
        userScrolled,
      });
    }
  }

  function handleScroll(): void {
    if (!userScrolled && !userScrollIntent) {
      return;
    }

    userScrollIntent = false;
    onScroll();
  }

  function handleWheel(event: WheelEvent): void {
    if (event.deltaY === 0) {
      return;
    }

    const outputEl = event.currentTarget;
    if (!(outputEl instanceof HTMLElement)) {
      return;
    }

    const isScrollingUp = event.deltaY < 0;
    const isAtTop = outputEl.scrollTop <= 0;
    const isScrollingDown = event.deltaY > 0;
    const isAtBottom = outputEl.scrollTop + outputEl.clientHeight >= outputEl.scrollHeight - 1;

    if ((isScrollingUp && isAtTop) || (isScrollingDown && isAtBottom)) {
      return;
    }

    userScrollIntent = true;
  }

  function handleMouseDown(event: MouseEvent): void {
    const outputEl = event.currentTarget;
    if (!(outputEl instanceof HTMLElement)) {
      return;
    }

    const rect = outputEl.getBoundingClientRect();
    const pointerNearScrollbar = rect.right - event.clientX <= 24;
    if (pointerNearScrollbar) {
      userScrollIntent = true;
    }
  }

  function handleScrollToBottomClick(): void {
    onScrollToBottom();
  }

  function handleContextMenu(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();

    window.dispatchEvent(new CustomEvent('mudshow-context-menu-open', { detail: { source: 'transcript' } }));

    const shellRect = transcriptShellElement?.getBoundingClientRect();
    contextMenuPosition = shellRect
      ? {
          x: Math.max(8, Math.min(event.clientX - shellRect.left, shellRect.width - 8)),
          y: Math.max(8, Math.min(event.clientY - shellRect.top, shellRect.height - 8)),
        }
      : {
          x: event.clientX,
          y: event.clientY,
        };
    contextMenuOpen = true;
  }

  function openNotesFromMenu(): void {
    closeContextMenu();
    onOpenNotes();
  }

  function openHighlightsFromMenu(): void {
    closeContextMenu();
    onOpenHighlights();
  }

  function closeTabFromMenu(anchorRect: DOMRect): void {
    closeContextMenu();
    onCloseRequest(anchorRect);
  }

  function handleLiveWheel(event: WheelEvent): void {
    const mainOutputId = `${scope}-output-area`;
    const mainOutput = document.getElementById(mainOutputId);

    if (!mainOutput) {
      return;
    }

    const delta = event.deltaMode === WheelEvent.DOM_DELTA_LINE
      ? event.deltaY * 16
      : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
        ? event.deltaY * mainOutput.clientHeight
        : event.deltaY;

    if (delta === 0) {
      return;
    }

    event.preventDefault();
    scrollElementBy(mainOutputId, delta);
  }

  onMount(() => {
    if (!transcriptContentElement) {
      return;
    }

    contentResizeObserver = new ResizeObserver(() => {
      if (IMAGE_PREVIEW_DIAGNOSTICS_ENABLED) {
        console.debug('[MUDShow] transcript resized', {
          scrollState: getScrollMetrics(),
          userScrolled,
        });
      }
      scrollTranscriptToBottomIfFollowing();
    });
    contentResizeObserver.observe(transcriptContentElement);
  });

  onDestroy(() => {
    contentResizeObserver?.disconnect();
    contentResizeObserver = null;
  });
</script>

<div
  bind:this={transcriptShellElement}
  class={`output-transcript-shell${splitView ? ' output-transcript-shell--split' : ''}`}
  style={`--play-width: ${width};`}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="output-area output-area--history">
    <div
      class="output-area output-area--history-scroller"
      id={`${scope}-output-area`}
      role="region"
      aria-label={splitView ? 'Transcript history' : 'Transcript output'}
      on:mouseup={handleMouseUp}
      on:click={handleClick}
      on:contextmenu={handleContextMenu}
      on:mousedown={handleMouseDown}
      on:wheel={handleWheel}
      on:scroll={handleScroll}
      on:load|capture={handlePreviewLoad}
      on:error|capture={handlePreviewError}
    >
      <div class="output-area-content" bind:this={transcriptContentElement}>
        {#each renderedChunks as renderedChunk}
          <div class="output-chunk">{@html renderedChunk}</div>
        {/each}
      </div>
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

  {#if splitView}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="output-area output-area--live"
      role="region"
      aria-label="Current output"
      on:mouseup={handleMouseUp}
      on:click={handleClick}
      on:contextmenu={handleContextMenu}
      on:wheel={handleLiveWheel}
    >
      <div class="output-area-content output-area-content--live">
        {#each liveRenderedChunks as renderedChunk}
          <div class="output-chunk">{@html renderedChunk}</div>
        {/each}
      </div>
    </div>
  {/if}

  <WorldContextMenu
    open={contextMenuOpen}
    position={contextMenuPosition}
    ariaLabel="transcript context menu"
    source="transcript"
    {canReconnect}
    {canDisconnect}
    {canQuickLog}
    {canStopLogging}
    {canEditWorld}
    {canEditCharacter}
    onReconnect={() => {
      closeContextMenu();
      onReconnect();
    }}
    onDisconnect={() => {
      closeContextMenu();
      onDisconnect();
    }}
    onQuickLog={() => {
      closeContextMenu();
      onQuickLog();
    }}
    onStopLogging={() => {
      closeContextMenu();
      onStopLogging();
    }}
    onOpenLogging={() => {
      closeContextMenu();
      onOpenLogging();
    }}
    onEditWorld={() => {
      closeContextMenu();
      onEditWorld();
    }}
    onEditCharacter={() => {
      closeContextMenu();
      onEditCharacter();
    }}
    onOpenNotes={openNotesFromMenu}
    onOpenHighlights={openHighlightsFromMenu}
    onDismiss={closeContextMenu}
    onCloseRequest={closeTabFromMenu}
  />
</div>
