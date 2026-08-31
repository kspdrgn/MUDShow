<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Readable } from 'svelte/store';
  import {
    buildHighlightRegexes,
    buildRuleRegexes,
  } from '../../formatting';
  import {
    isTranscriptDiagnosticsEnabled,
    setTranscriptDiagnosticsEnabled,
  } from '../../formatting';
  import type { PlayTranscript, RenderCache } from '../../playback';
  import {
    copyTextToClipboard,
    focusElement,
    nextFrame,
    scrollElementBy,
  } from '../../session-dom';
  import { openExternalUrl } from '../../tauri';
  import { getScopedInputBarInputId, type InputBarId } from '../../input-bars';
  import type { HighlightRule, Rule, Trigger } from '../../types';
  import WorldContextMenu from './WorldContextMenu.svelte';
  import {
    HISTORY_OVERSCAN_PX,
    LIVE_OVERSCAN_PX,
    getTranscriptWheelDelta,
  } from './transcript-viewport';
  import {
    buildTranscriptChunkTitle,
    buildTranscriptRenderDependencyKey,
    buildTranscriptVisibleRange,
    renderTranscriptChunk,
  } from './transcript-render';
  import { getTranscriptContextMenuPosition } from './transcript-context-menu';
  import {
    getTranscriptHistoryMetrics,
    getTranscriptScrollMetrics,
    scrollTranscriptToBottomIfFollowing,
  } from './transcript-scroll';
  import { setupTranscriptObservers } from './transcript-observers';

  export let activeBar: InputBarId = 1;
  export let transcript: PlayTranscript;
  export let outputRevision = 0;
  export let width = 'none';
  export let outputFontSize = 13;
  export let scope = 'world';
  export let visible = true;
  export let triggers: Trigger[] = [];
  export let linkImagePreviews = false;
  export let imagePreviewCacheVersion = 0;
  export let renderCache: RenderCache | null = null;
  export let showCurrentOutputWhenScrollingUp = true;
  export let transcriptDiagnosticsEnabled = false;
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
  export let onOpenDebugConsole: () => void;
  export let onOpenTriggers: () => void;
  export let onOpenStyles: () => void;
  export let onCloseRequest: (anchorRect: DOMRect) => void;
  export let onScroll: () => void;
  export let onScrollToBottom: () => void;
  export let workspaceState: Readable<Record<string, unknown>> | null = null;

  let highlights: HighlightRule[] = [];
  let rules: Rule[] = [];
  let highlightRegexes = buildHighlightRegexes(highlights);
  let ruleRegexes = buildRuleRegexes(rules);
  type RenderedChunk = { id: number; html: string; title: string };
  let renderedChunks: RenderedChunk[] = [];
  let liveRenderedChunks: RenderedChunk[] = [];
  let renderedTopSpacer = 0;
  let renderedBottomSpacer = 0;
  let liveTopSpacer = 0;
  let liveBottomSpacer = 0;
  let historyScrollTop = 0;
  let historyViewportHeight = 0;
  let liveViewportHeight = 0;
  let splitView = false;
  let hiddenPreviewUrls = new Set<string>();
  let transcriptShellElement: HTMLDivElement | null = null;
  let transcriptContentElement: HTMLDivElement | null = null;
  let transcriptHistoryScrollerElement: HTMLDivElement | null = null;
  let transcriptLiveElement: HTMLDivElement | null = null;
  let contextMenuOpen = false;
  let contextMenuPosition = { x: 0, y: 0 };
  let transcriptZoom = 1;
  let removeZoomKeydownListener: (() => void) | null = null;
  let removeWorkspaceStateListener: (() => void) | null = null;
  let userScrollIntent = false;
  let lastSyncedTranscript: PlayTranscript | null = null;
  let lastSyncedRevision = -1;
  let lastSyncedScrollTop = -1;
  let lastSyncedHistoryHeight = -1;
  let lastSyncedLiveHeight = -1;
  let lastSyncedWidth = width;
  let renderDependencyKey = '';
  let lastRenderDependencyKey = '';
  let resizeReconcileFrame: number | null = null;
  let transcriptDestroyed = false;
  const MIN_TRANSCRIPT_ZOOM = 0.6;
  const MAX_TRANSCRIPT_ZOOM = 2;
  const TRANSCRIPT_ZOOM_STEP = 0.1;

  function closeContextMenu(): void {
    contextMenuOpen = false;
  }

  function logTranscriptDiagnostics(event: string, details: Record<string, unknown>): void {
    if (!isTranscriptDiagnosticsEnabled()) {
      return;
    }

    console.debug(`[MUDShow] transcript ${event}`, details);
  }

  function clampTranscriptZoom(value: number): number {
    return Math.min(MAX_TRANSCRIPT_ZOOM, Math.max(MIN_TRANSCRIPT_ZOOM, Math.round(value * 10) / 10));
  }

  function setTranscriptZoom(nextZoom: number): void {
    transcriptZoom = clampTranscriptZoom(nextZoom);
  }

  function zoomTranscriptIn(): void {
    setTranscriptZoom(transcriptZoom + TRANSCRIPT_ZOOM_STEP);
  }

  function zoomTranscriptOut(): void {
    setTranscriptZoom(transcriptZoom - TRANSCRIPT_ZOOM_STEP);
  }

  function resetTranscriptZoom(): void {
    setTranscriptZoom(1);
  }

  function handleTranscriptZoomKeydown(event: KeyboardEvent): void {
    if (!visible || event.defaultPrevented) {
      return;
    }

    if (!(event.ctrlKey || event.metaKey)) {
      return;
    }

    const key = event.key;
    const isZoomIn = key === '+' || key === '=' || event.code === 'NumpadAdd';
    const isZoomOut = key === '-' || key === '_' || event.code === 'NumpadSubtract';
    const isZoomReset = key === '0' || event.code === 'Digit0' || event.code === 'Numpad0';

    if (!isZoomIn && !isZoomOut && !isZoomReset) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (isZoomReset) {
      resetTranscriptZoom();
      return;
    }

    if (isZoomIn) {
      zoomTranscriptIn();
      return;
    }

    zoomTranscriptOut();
  }

  function syncTranscriptZoomListener(): void {
    if (visible) {
      if (removeZoomKeydownListener) {
        return;
      }

      window.addEventListener('keydown', handleTranscriptZoomKeydown, true);
      removeZoomKeydownListener = () => window.removeEventListener('keydown', handleTranscriptZoomKeydown, true);
      return;
    }

    removeZoomKeydownListener?.();
    removeZoomKeydownListener = null;
  }

  function applyWorkspaceState(nextState: Record<string, unknown>): void {
    if (nextState.activeBar !== undefined) activeBar = nextState.activeBar as InputBarId;
    if (nextState.transcript !== undefined) transcript = nextState.transcript as PlayTranscript;
    if (nextState.outputRevision !== undefined) outputRevision = nextState.outputRevision as number;
    if (nextState.width !== undefined) width = nextState.width as string;
    if (nextState.outputFontSize !== undefined) outputFontSize = nextState.outputFontSize as number;
    if (nextState.scope !== undefined) scope = nextState.scope as string;
    if (nextState.visible !== undefined) visible = nextState.visible as boolean;
    if (nextState.triggers !== undefined) triggers = nextState.triggers as Trigger[];
    if (nextState.linkImagePreviews !== undefined) linkImagePreviews = nextState.linkImagePreviews as boolean;
    if (nextState.imagePreviewCacheVersion !== undefined) imagePreviewCacheVersion = nextState.imagePreviewCacheVersion as number;
    if (nextState.renderCache !== undefined) renderCache = nextState.renderCache as RenderCache | null;
    if (nextState.showCurrentOutputWhenScrollingUp !== undefined) {
      showCurrentOutputWhenScrollingUp = nextState.showCurrentOutputWhenScrollingUp as boolean;
    }
    if (nextState.transcriptDiagnosticsEnabled !== undefined) {
      transcriptDiagnosticsEnabled = nextState.transcriptDiagnosticsEnabled as boolean;
    }
    if (nextState.userScrolled !== undefined) userScrolled = nextState.userScrolled as boolean;
    if (nextState.canReconnect !== undefined) canReconnect = nextState.canReconnect as boolean;
    if (nextState.canDisconnect !== undefined) canDisconnect = nextState.canDisconnect as boolean;
    if (nextState.canQuickLog !== undefined) canQuickLog = nextState.canQuickLog as boolean;
    if (nextState.canStopLogging !== undefined) canStopLogging = nextState.canStopLogging as boolean;
    if (nextState.canEditWorld !== undefined) canEditWorld = nextState.canEditWorld as boolean;
    if (nextState.canEditCharacter !== undefined) canEditCharacter = nextState.canEditCharacter as boolean;
    if (nextState.onReconnect !== undefined) onReconnect = nextState.onReconnect as () => void;
    if (nextState.onDisconnect !== undefined) onDisconnect = nextState.onDisconnect as () => void;
    if (nextState.onQuickLog !== undefined) onQuickLog = nextState.onQuickLog as () => void;
    if (nextState.onStopLogging !== undefined) onStopLogging = nextState.onStopLogging as () => void;
    if (nextState.onOpenLogging !== undefined) onOpenLogging = nextState.onOpenLogging as () => void;
    if (nextState.onEditWorld !== undefined) onEditWorld = nextState.onEditWorld as () => void;
    if (nextState.onEditCharacter !== undefined) onEditCharacter = nextState.onEditCharacter as () => void;
    if (nextState.onOpenNotes !== undefined) onOpenNotes = nextState.onOpenNotes as () => void;
    if (nextState.onOpenDebugConsole !== undefined) onOpenDebugConsole = nextState.onOpenDebugConsole as () => void;
    if (nextState.onOpenTriggers !== undefined) onOpenTriggers = nextState.onOpenTriggers as () => void;
    if (nextState.onOpenStyles !== undefined) onOpenStyles = nextState.onOpenStyles as () => void;
    if (nextState.onCloseRequest !== undefined) onCloseRequest = nextState.onCloseRequest as (anchorRect: DOMRect) => void;
    if (nextState.onScroll !== undefined) onScroll = nextState.onScroll as () => void;
    if (nextState.onScrollToBottom !== undefined) onScrollToBottom = nextState.onScrollToBottom as () => void;
  }

  $: highlights = triggers.filter((trigger): trigger is HighlightRule => trigger.type === 'highlight');
  $: rules = triggers.filter((trigger): trigger is Rule => trigger.type === 'rule');
  $: highlightRegexes = buildHighlightRegexes(highlights);
  $: ruleRegexes = buildRuleRegexes(rules);
  $: splitView = showCurrentOutputWhenScrollingUp && userScrolled;
  $: setTranscriptDiagnosticsEnabled(transcriptDiagnosticsEnabled);

  $: {
    // Touch the inputs directly so Svelte reruns this block when they change.
    triggers;
    linkImagePreviews;
    imagePreviewCacheVersion;
    hiddenPreviewUrls;

    const nextRenderDependencyKey = buildTranscriptRenderDependencyKey(
      triggers,
      linkImagePreviews,
      imagePreviewCacheVersion,
      hiddenPreviewUrls,
    );
    if (nextRenderDependencyKey !== renderDependencyKey) {
      renderDependencyKey = nextRenderDependencyKey;
      renderCache?.clear();
      lastSyncedTranscript = null;
      lastSyncedRevision = -1;
      renderedChunks = [];
      liveRenderedChunks = [];
    }
  }

  $: {
    transcript;
    outputRevision;
    width;
    visible;
    splitView;
    hiddenPreviewUrls;
    triggers;
    linkImagePreviews;
    imagePreviewCacheVersion;
    renderCache;
    syncTranscriptRenderState();
  }

  $: {
    visible;
    syncTranscriptZoomListener();
  }

  function syncTranscriptRenderState(): void {
    if (!transcript) {
      renderedChunks = [];
      liveRenderedChunks = [];
      renderedTopSpacer = 0;
      renderedBottomSpacer = 0;
      liveTopSpacer = 0;
      liveBottomSpacer = 0;
      lastSyncedTranscript = null;
      lastSyncedRevision = outputRevision;
      lastSyncedScrollTop = -1;
      lastSyncedHistoryHeight = -1;
      lastSyncedLiveHeight = -1;
      return;
    }

    if (lastSyncedWidth !== width) {
      lastSyncedWidth = width;
      lastSyncedTranscript = null;
      lastSyncedRevision = -1;
      lastSyncedScrollTop = -1;
      lastSyncedHistoryHeight = -1;
      lastSyncedLiveHeight = -1;
    }

    if (lastSyncedTranscript !== transcript || lastRenderDependencyKey !== renderDependencyKey) {
      lastRenderDependencyKey = renderDependencyKey;
      lastSyncedTranscript = transcript;
      lastSyncedRevision = -1;
      lastSyncedScrollTop = -1;
      lastSyncedHistoryHeight = -1;
      lastSyncedLiveHeight = -1;
    }

    const historyMetrics = getTranscriptHistoryMetrics(
      transcriptHistoryScrollerElement ?? document.getElementById(`${scope}-output-area`),
      historyScrollTop,
      historyViewportHeight,
    );
    const liveHeight = splitView && transcriptLiveElement instanceof HTMLElement ? transcriptLiveElement.clientHeight : 0;

    if (
      outputRevision === lastSyncedRevision &&
      historyMetrics.scrollTop === lastSyncedScrollTop &&
      historyMetrics.clientHeight === lastSyncedHistoryHeight &&
      liveHeight === lastSyncedLiveHeight &&
      renderedChunks.length > 0
    ) {
      return;
    }

    historyScrollTop = historyMetrics.scrollTop;
    historyViewportHeight = historyMetrics.clientHeight;
    const anchorHistoryToBottom = !userScrolled;
    const historyRange = buildTranscriptVisibleRange(
      transcript,
      historyScrollTop,
      historyViewportHeight,
      HISTORY_OVERSCAN_PX,
      true,
      anchorHistoryToBottom,
      {
        width,
        renderDependencyKey,
        renderCache,
        linkImagePreviews,
        hiddenPreviewUrls,
        imagePreviewCacheVersion,
        ruleRegexes,
        highlightRegexes,
      },
    );
    renderedChunks = historyRange.rendered;
    renderedTopSpacer = historyRange.topSpacer;
    renderedBottomSpacer = historyRange.bottomSpacer;

    if (splitView) {
      liveViewportHeight = liveHeight;
      const liveRange = buildTranscriptVisibleRange(
        transcript,
        0,
        liveViewportHeight,
        LIVE_OVERSCAN_PX,
        false,
        true,
        {
          width,
          renderDependencyKey,
          renderCache,
          linkImagePreviews,
          hiddenPreviewUrls,
          imagePreviewCacheVersion,
          ruleRegexes,
          highlightRegexes,
        },
      );
      liveRenderedChunks = liveRange.rendered;
      liveTopSpacer = liveRange.topSpacer;
      liveBottomSpacer = liveRange.bottomSpacer;
    } else {
      liveRenderedChunks = [];
      liveTopSpacer = 0;
      liveBottomSpacer = 0;
    }

    logTranscriptDiagnostics('render state', {
      scope,
      outputRevision,
      splitView,
      userScrolled,
      width,
      historyMetrics,
      liveHeight,
      historyRange: {
        startIndex: historyRange.startIndex,
        endIndex: historyRange.endIndex,
        topSpacer: historyRange.topSpacer,
        bottomSpacer: historyRange.bottomSpacer,
        renderedCount: historyRange.rendered.length,
      },
      liveRange: splitView
        ? {
            topSpacer: liveTopSpacer,
            bottomSpacer: liveBottomSpacer,
            renderedCount: liveRenderedChunks.length,
            viewportHeight: liveViewportHeight,
          }
        : null,
    });

    if (renderedChunks.length === 0 && transcript.getChunkCount() > 0) {
      const lastChunk = transcript.getChunk(transcript.getChunkCount() - 1);
      if (lastChunk) {
        renderedChunks = [{
          id: lastChunk.id,
          html: renderTranscriptChunk(
            lastChunk,
            true,
            renderDependencyKey,
            renderCache,
            linkImagePreviews,
            hiddenPreviewUrls,
            imagePreviewCacheVersion,
            ruleRegexes,
            highlightRegexes,
          ),
          title: buildTranscriptChunkTitle(lastChunk),
        }];
        renderedTopSpacer = Math.max(0, renderedTopSpacer);
        renderedBottomSpacer = 0;
      }
    }

    lastSyncedRevision = outputRevision;
    lastSyncedScrollTop = historyMetrics.scrollTop;
    lastSyncedHistoryHeight = historyMetrics.clientHeight;
    lastSyncedLiveHeight = liveHeight;

  }

  function getScrollMetrics(): {
    scrollTop: number;
    scrollHeight: number;
    clientHeight: number;
    distanceFromBottom: number;
  } | null {
    return getTranscriptScrollMetrics(document.getElementById(`${scope}-output-area`) as HTMLElement | null);
  }

  function syncTranscriptScrollMetrics(): void {
    const historyElement = transcriptHistoryScrollerElement
      ?? document.getElementById(`${scope}-output-area`);

    if (historyElement instanceof HTMLElement) {
      historyScrollTop = historyElement.scrollTop;
      historyViewportHeight = historyElement.clientHeight;
    }

    if (splitView && transcriptLiveElement instanceof HTMLElement) {
      liveViewportHeight = transcriptLiveElement.clientHeight;
    }
  }

  function scheduleTranscriptResizeReconcile(): void {
    if (resizeReconcileFrame !== null || transcriptDestroyed) {
      return;
    }

    resizeReconcileFrame = requestAnimationFrame(() => {
      resizeReconcileFrame = null;

      if (transcriptDestroyed) {
        return;
      }

      const scrollBefore = isTranscriptDiagnosticsEnabled() ? getScrollMetrics() : null;
      syncTranscriptScrollMetrics();
      syncTranscriptRenderState();

      void tick().then(() => {
        if (transcriptDestroyed) {
          return;
        }

        syncTranscriptRenderState();
        scrollTranscriptToBottomIfFollowing(scope, userScrolled);
        syncTranscriptScrollMetrics();

        logTranscriptDiagnostics('resize reconcile', {
          scope,
          userScrolled,
          scrollBefore,
          scrollAfter: getScrollMetrics(),
          historyScrollTop,
          historyViewportHeight,
          liveViewportHeight,
        });
      });
    });
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
    const scrollBefore = isTranscriptDiagnosticsEnabled() ? getScrollMetrics() : null;

    if (previewItem) {
      previewItem.dataset.previewLoaded = 'true';
    }

    const previewUrl = target.getAttribute('data-preview-url') ?? target.currentSrc ?? target.src;
    if (isTranscriptDiagnosticsEnabled()) {
      console.info('[MUDShow] image preview loaded', {
        url: previewUrl,
        naturalWidth: target.naturalWidth,
        naturalHeight: target.naturalHeight,
        currentSrc: target.currentSrc || target.src,
        hostElement: target.parentElement?.tagName.toLowerCase() ?? 'img',
      });
    }

    if (isTranscriptDiagnosticsEnabled()) {
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
      if (isTranscriptDiagnosticsEnabled()) {
        console.debug('[MUDShow] image preview post-load', {
          url: previewUrl,
          imageHeightAfterReveal: target.getBoundingClientRect().height,
          previewHeightAfterReveal: previewItem?.getBoundingClientRect().height ?? null,
          scrollAfter: getScrollMetrics(),
          userScrolled,
        });
      }
      scrollTranscriptToBottomIfFollowing(scope, userScrolled);
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
    if (isTranscriptDiagnosticsEnabled()) {
      console.warn('[MUDShow] image preview failed to load', {
        url: previewUrl,
        currentSrc: target.currentSrc || target.src,
        complete: target.complete,
        naturalWidth: target.naturalWidth,
        naturalHeight: target.naturalHeight,
      });
    }

    if (isTranscriptDiagnosticsEnabled()) {
      console.debug('[MUDShow] image preview error', {
        url: previewUrl,
        previewHeight: previewItem?.getBoundingClientRect().height ?? null,
        scrollState: getScrollMetrics(),
        userScrolled,
      });
    }
  }

  function handleScroll(event: Event): void {
    const outputEl = event.currentTarget;
    let nextUserScrolled = userScrolled;
    if (outputEl instanceof HTMLElement) {
      historyScrollTop = outputEl.scrollTop;
      historyViewportHeight = outputEl.clientHeight;
      nextUserScrolled = outputEl.scrollHeight - outputEl.scrollTop - outputEl.clientHeight > 2;
    }

    logTranscriptDiagnostics('scroll', {
      scope,
      scrollTop: outputEl instanceof HTMLElement ? outputEl.scrollTop : null,
      scrollHeight: outputEl instanceof HTMLElement ? outputEl.scrollHeight : null,
      clientHeight: outputEl instanceof HTMLElement ? outputEl.clientHeight : null,
      userScrolled,
      splitView,
    });

    userScrollIntent = false;
    // Parent store updates are batched. Keep the local render pass in sync
    // with the actual scroll position so it cannot re-anchor an upward scroll
    // to the bottom before the parent update is applied.
    userScrolled = nextUserScrolled;
    onScroll();
    syncTranscriptRenderState();

    // Let the parent update userScrolled before recalculating the virtualized
    // range. If virtualization runs first while userScrolled is false, it
    // anchors the range to the bottom and makes an upward scroll look like a
    // no-op. The second check also lets split view collapse after the new
    // range has been applied when the user reaches the real bottom.
    void nextFrame().then(() => {
      syncTranscriptRenderState();
      onScroll();
    });
  }

  function handleWheel(event: WheelEvent): void {
    if (event.deltaY === 0) {
      return;
    }

    const outputEl = event.currentTarget;
    if (!(outputEl instanceof HTMLElement)) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      logTranscriptDiagnostics('wheel zoom', {
        scope,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
      });
      if (event.deltaY < 0) {
        zoomTranscriptIn();
      } else {
        zoomTranscriptOut();
      }
      return;
    }

    const isScrollingUp = event.deltaY < 0;
    const isAtTop = outputEl.scrollTop <= 0;
    const isScrollingDown = event.deltaY > 0;
    const isAtBottom = outputEl.scrollTop + outputEl.clientHeight >= outputEl.scrollHeight - 1;

    if ((isScrollingUp && isAtTop) || (isScrollingDown && isAtBottom)) {
      return;
    }

    logTranscriptDiagnostics('wheel scroll intent', {
      scope,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      isScrollingUp,
      isScrollingDown,
      isAtTop,
      isAtBottom,
    });
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

    const shellRect = transcriptShellElement?.getBoundingClientRect() ?? null;
    contextMenuPosition = getTranscriptContextMenuPosition(shellRect, event.clientX, event.clientY);
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

    if (!(mainOutput instanceof HTMLElement)) {
      return;
    }

    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
      logTranscriptDiagnostics('live wheel zoom', {
        scope,
        deltaY: event.deltaY,
        deltaMode: event.deltaMode,
      });
      if (event.deltaY < 0) {
        zoomTranscriptIn();
      } else {
        zoomTranscriptOut();
      }
      return;
    }

    const delta = getTranscriptWheelDelta(event, mainOutput);

    if (delta === 0) {
      return;
    }

    logTranscriptDiagnostics('live wheel forward', {
      scope,
      delta,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
    });

    scrollElementBy(mainOutputId, delta);
  }

  onMount(() => {
    syncTranscriptZoomListener();

    removeWorkspaceStateListener = workspaceState?.subscribe(applyWorkspaceState) ?? null;

    // Dockview can finish sizing the panel one frame after this component mounts.
    // Recheck after layout so virtualization does not remain stuck at a zero height.
    const firstLayoutFrame = requestAnimationFrame(() => {
      syncTranscriptRenderState();
      scrollTranscriptToBottomIfFollowing(scope, userScrolled);
    });
    const secondLayoutFrame = requestAnimationFrame(() => {
      syncTranscriptRenderState();
      scrollTranscriptToBottomIfFollowing(scope, userScrolled);
    });

    const disposeObservers = setupTranscriptObservers({
      contentElement: transcriptContentElement,
      historyElement: transcriptHistoryScrollerElement,
      onResize: scheduleTranscriptResizeReconcile,
    });

    return () => {
      cancelAnimationFrame(firstLayoutFrame);
      cancelAnimationFrame(secondLayoutFrame);
      if (resizeReconcileFrame !== null) {
        cancelAnimationFrame(resizeReconcileFrame);
        resizeReconcileFrame = null;
      }
      disposeObservers();
      removeWorkspaceStateListener?.();
      removeWorkspaceStateListener = null;
    };
  });

  onDestroy(() => {
    transcriptDestroyed = true;
    if (resizeReconcileFrame !== null) {
      cancelAnimationFrame(resizeReconcileFrame);
      resizeReconcileFrame = null;
    }
    removeZoomKeydownListener?.();
    removeZoomKeydownListener = null;
  });
</script>

<div
  bind:this={transcriptShellElement}
  class={`output-transcript-shell${splitView ? ' output-transcript-shell--split' : ''}`}
  style={`--play-width: ${width};`}
  style:--world-output-font-size={`${outputFontSize * transcriptZoom}px`}
>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div class="output-area output-area--history">
    <div
      bind:this={transcriptHistoryScrollerElement}
      class="output-area output-area--history-scroller"
      id={`${scope}-output-area`}
      role="region"
      aria-label={splitView ? 'Transcript history' : 'Transcript output'}
      on:mouseup={handleMouseUp}
      on:click={handleClick}
      on:contextmenu={handleContextMenu}
      on:mousedown={handleMouseDown}
      on:wheel|nonpassive={handleWheel}
      on:scroll={handleScroll}
      on:load|capture={handlePreviewLoad}
      on:error|capture={handlePreviewError}
    >
      <div class="output-area-content" bind:this={transcriptContentElement}>
        <div class="output-spacer" aria-hidden="true" style={`height: ${renderedTopSpacer}px;`}></div>
        {#each renderedChunks as renderedChunk (renderedChunk.id)}
          <div class="output-chunk" title={renderedChunk.title}>{@html renderedChunk.html}</div>
        {/each}
        <div class="output-spacer" aria-hidden="true" style={`height: ${renderedBottomSpacer}px;`}></div>
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
      bind:this={transcriptLiveElement}
      class="output-area output-area--live"
      role="region"
      aria-label="Current output"
      on:mouseup={handleMouseUp}
      on:click={handleClick}
      on:contextmenu={handleContextMenu}
      on:wheel|nonpassive={handleLiveWheel}
    >
      <div class="output-area-content output-area-content--live">
        <div class="output-spacer" aria-hidden="true" style={`height: ${liveTopSpacer}px;`}></div>
        {#each liveRenderedChunks as renderedChunk (renderedChunk.id)}
          <div class="output-chunk" title={renderedChunk.title}>{@html renderedChunk.html}</div>
        {/each}
        <div class="output-spacer" aria-hidden="true" style={`height: ${liveBottomSpacer}px;`}></div>
      </div>
    </div>
  {/if}

  <WorldContextMenu
    open={contextMenuOpen}
    position={contextMenuPosition}
    ariaLabel="transcript context menu"
    source="transcript"
    {transcriptZoom}
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
    onOpenDebugConsole={() => {
      closeContextMenu();
      onOpenDebugConsole();
    }}
    onOpenTriggers={openTriggersFromMenu}
    onOpenStyles={() => {
      closeContextMenu();
      onOpenStyles();
    }}
    onZoomIn={() => {
      zoomTranscriptIn();
    }}
    onZoomOut={() => {
      zoomTranscriptOut();
    }}
    onZoomReset={() => {
      resetTranscriptZoom();
    }}
    onDismiss={closeContextMenu}
    onCloseRequest={closeTabFromMenu}
  />
</div>
