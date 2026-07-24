<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import {
    applyHighlights,
    applyRulesWithResult,
    buildHighlightRegexes,
    buildRuleRegexes,
    renderTranscriptHtml,
  } from '../../formatting';
  import type { PlayTranscript, RenderCache, TranscriptChunkEntry } from '../../playback';
  import {
    copyTextToClipboard,
    focusElement,
    nextFrame,
    scrollElementBy,
    scrollElementToBottom,
  } from '../../session-dom';
  import { openExternalUrl } from '../../tauri';
  import { getScopedInputBarInputId, type InputBarId } from '../../input-bars';
  import type { HighlightRule, Rule, Trigger } from '../../types';
  import WorldContextMenu from './WorldContextMenu.svelte';

  const IMAGE_PREVIEW_DIAGNOSTICS_ENABLED = false;

  export let activeBar: InputBarId = 1;
  export let transcript: PlayTranscript;
  export let outputRevision = 0;
  export let width = 'none';
  export let scope = 'world';
  export let triggers: Trigger[] = [];
  export let linkImagePreviews = false;
  export let imagePreviewCacheVersion = 0;
  export let renderCache: RenderCache | null = null;
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
  export let onOpenTriggers: () => void;
  export let onCloseRequest: (anchorRect: DOMRect) => void;
  export let onScroll: () => void;
  export let onScrollToBottom: () => void;

  let highlights: HighlightRule[] = [];
  let rules: Rule[] = [];
  let highlightRegexes = buildHighlightRegexes(highlights);
  let ruleRegexes = buildRuleRegexes(rules);
  type RenderedChunk = { id: number; html: string; title: string };
  let renderedChunks: RenderedChunk[] = [];
  let liveRenderedChunks: RenderedChunk[] = [];
  let splitView = false;
  let hiddenPreviewUrls = new Set<string>();
  let transcriptShellElement: HTMLDivElement | null = null;
  let transcriptContentElement: HTMLDivElement | null = null;
  let contextMenuOpen = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let contentResizeObserver: ResizeObserver | null = null;
  let userScrollIntent = false;
  let lastSyncedTranscript: PlayTranscript | null = null;
  let lastSyncedRevision = -1;
  let renderDependencyKey = '';
  let lastRenderDependencyKey = '';

  function closeContextMenu(): void {
    contextMenuOpen = false;
  }

  $: highlights = triggers.filter((trigger): trigger is HighlightRule => trigger.type === 'highlight');
  $: rules = triggers.filter((trigger): trigger is Rule => trigger.type === 'rule');
  $: highlightRegexes = buildHighlightRegexes(highlights);
  $: ruleRegexes = buildRuleRegexes(rules);
  $: splitView = showCurrentOutputWhenScrollingUp && userScrolled;

  $: {
    const nextRenderDependencyKey = buildRenderDependencyKey();
    if (nextRenderDependencyKey !== renderDependencyKey) {
      renderDependencyKey = nextRenderDependencyKey;
      renderCache?.clear();
      lastSyncedTranscript = null;
      lastSyncedRevision = -1;
      renderedChunks = [];
      liveRenderedChunks = [];
    }
  }

  $: syncTranscriptRenderState();

  function buildRenderDependencyKey(): string {
    const triggerKey = triggers
      .map((trigger) => {
        if (trigger.type === 'highlight') {
          return [
            'h',
            trigger.id,
            trigger.owner.kind,
            trigger.owner.kind === 'world'
              ? trigger.owner.worldId
              : trigger.owner.kind === 'character'
                ? trigger.owner.characterId
                : '',
            trigger.pattern,
            trigger.caseSensitive ? '1' : '0',
            trigger.wordBoundary ? '1' : '0',
            trigger.foregroundColor ?? '',
            trigger.backgroundColor ?? '',
          ].join(':');
        }

        return [
          'r',
          trigger.id,
          trigger.owner.kind,
          trigger.owner.kind === 'world'
            ? trigger.owner.worldId
            : trigger.owner.kind === 'character'
              ? trigger.owner.characterId
              : '',
          trigger.label,
          trigger.pattern,
          trigger.caseSensitive ? '1' : '0',
          trigger.wholeLine ? '1' : '0',
          trigger.stopOtherRules ? '1' : '0',
          trigger.stopHighlights ? '1' : '0',
          trigger.foregroundColor ?? '',
          trigger.backgroundColor ?? '',
          trigger.opacity ?? '',
          trigger.sampleText,
        ].join(':');
      })
      .join('|');

    const hiddenPreviewKey = [...hiddenPreviewUrls].sort().join('|');
    return [
      linkImagePreviews ? '1' : '0',
      String(imagePreviewCacheVersion),
      triggerKey,
      hiddenPreviewKey,
    ].join('|');
  }

  function renderChunkHtml(chunk: TranscriptChunkEntry, includePreviews: boolean): string {
    const ruleResult = applyRulesWithResult(
      renderTranscriptHtml(
        chunk.text,
        includePreviews ? linkImagePreviews : false,
        hiddenPreviewUrls,
        includePreviews ? imagePreviewCacheVersion : 0,
      ),
      ruleRegexes,
    );

    return ruleResult.stopHighlights ? ruleResult.html : applyHighlights(ruleResult.html, highlightRegexes);
  }

  function buildChunkTitle(chunk: TranscriptChunkEntry): string {
    const lineLabel = chunk.lineCount === 1 ? 'line' : 'lines';
    const charLabel = chunk.charCount === 1 ? 'char' : 'chars';
    const newlineLabel = chunk.text.endsWith('\n') ? 'ends with newline' : 'no trailing newline';

    return `Chunk #${chunk.id}\n${chunk.lineCount} ${lineLabel}\n${chunk.charCount} ${charLabel}\n${newlineLabel}`;
  }

  function renderChunk(chunk: TranscriptChunkEntry, includePreviews: boolean): string {
    const cacheKey = `${includePreviews ? 'live' : 'history'}:${renderDependencyKey}:${chunk.id}`;
    if (renderCache) {
      return renderCache.getOrSet(cacheKey, () => renderChunkHtml(chunk, includePreviews));
    }

    return renderChunkHtml(chunk, includePreviews);
  }

  function rebuildRenderedChunks(): void {
    const count = transcript.getChunkCount();
    const nextRenderedChunks: RenderedChunk[] = [];
    const nextLiveRenderedChunks: RenderedChunk[] = [];

    for (let index = 0; index < count; index += 1) {
      const chunk = transcript.getChunk(index);
      if (!chunk) {
        continue;
      }

      nextRenderedChunks.push({
        id: chunk.id,
        html: renderChunk(chunk, true),
      });
      nextLiveRenderedChunks.push({
        id: chunk.id,
        html: renderChunk(chunk, false),
      });
    }

    renderedChunks = nextRenderedChunks;
    liveRenderedChunks = nextLiveRenderedChunks;
    lastSyncedTranscript = transcript;
    lastSyncedRevision = outputRevision;
    lastRenderDependencyKey = renderDependencyKey;
  }

  function syncTranscriptRenderState(): void {
    if (!transcript) {
      renderedChunks = [];
      liveRenderedChunks = [];
      lastSyncedTranscript = null;
      lastSyncedRevision = outputRevision;
      return;
    }

    if (lastSyncedTranscript !== transcript || lastRenderDependencyKey !== renderDependencyKey) {
      lastRenderDependencyKey = renderDependencyKey;
      rebuildRenderedChunks();
      return;
    }

    if (outputRevision === lastSyncedRevision) {
      return;
    }

    const currentCount = transcript.getChunkCount();
    const currentFirstChunk = currentCount > 0 ? transcript.getChunk(0) ?? null : null;
    const previousCount = renderedChunks.length;
    const previousFirstChunkId = renderedChunks[0]?.id ?? null;

    if (currentCount === 0) {
      renderedChunks = [];
      liveRenderedChunks = [];
      lastSyncedRevision = outputRevision;
      lastRenderDependencyKey = renderDependencyKey;
      return;
    }

    if (previousCount === 0 || previousFirstChunkId === null || currentFirstChunk === null) {
      rebuildRenderedChunks();
      lastRenderDependencyKey = renderDependencyKey;
      return;
    }

    if (currentFirstChunk.id === previousFirstChunkId && currentCount >= previousCount) {
      for (let index = previousCount; index < currentCount; index += 1) {
        const chunk = transcript.getChunk(index);
        if (!chunk) {
          continue;
        }

        renderedChunks.push({
          id: chunk.id,
          html: renderChunk(chunk, true),
          title: buildChunkTitle(chunk),
        });
        liveRenderedChunks.push({
          id: chunk.id,
          html: renderChunk(chunk, false),
          title: buildChunkTitle(chunk),
        });
      }

      lastSyncedRevision = outputRevision;
      lastRenderDependencyKey = renderDependencyKey;
      return;
    }

    const droppedCount = currentFirstChunk.id - previousFirstChunkId;
    if (droppedCount > 0 && droppedCount <= previousCount) {
      renderedChunks = renderedChunks.slice(droppedCount);
      liveRenderedChunks = liveRenderedChunks.slice(droppedCount);

      const nextStartIndex = previousCount - droppedCount;
      for (let index = nextStartIndex; index < currentCount; index += 1) {
        const chunk = transcript.getChunk(index);
        if (!chunk) {
          continue;
        }

        renderedChunks.push({
          id: chunk.id,
          html: renderChunk(chunk, true),
          title: buildChunkTitle(chunk),
        });
        liveRenderedChunks.push({
          id: chunk.id,
          html: renderChunk(chunk, false),
          title: buildChunkTitle(chunk),
        });
      }

      lastSyncedRevision = outputRevision;
      lastRenderDependencyKey = renderDependencyKey;
      return;
    }

    rebuildRenderedChunks();
    lastRenderDependencyKey = renderDependencyKey;
  }

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

  function openTriggersFromMenu(): void {
    closeContextMenu();
    onOpenTriggers();
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
      on:wheel|passive={handleWheel}
      on:scroll={handleScroll}
      on:load|capture={handlePreviewLoad}
      on:error|capture={handlePreviewError}
    >
      <div class="output-area-content" bind:this={transcriptContentElement}>
        {#each renderedChunks as renderedChunk (renderedChunk.id)}
          <div class="output-chunk" title={renderedChunk.title}>{@html renderedChunk.html}</div>
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
      on:wheel|passive={handleLiveWheel}
    >
      <div class="output-area-content output-area-content--live">
        {#each liveRenderedChunks as renderedChunk (renderedChunk.id)}
          <div class="output-chunk" title={renderedChunk.title}>{@html renderedChunk.html}</div>
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
    onOpenTriggers={openTriggersFromMenu}
    onDismiss={closeContextMenu}
    onCloseRequest={closeTabFromMenu}
  />
</div>
