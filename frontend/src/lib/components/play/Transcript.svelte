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
  import { getTranscriptRangeTextByChunkIds, type PlayTranscript, type RenderCache } from '../../playback';
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
  import type { LastActivityMarker } from '../../transcript-indicators';
  import {
    compareTranscriptBoundaries,
    createTranscriptRangeSelection,
    EMPTY_TRANSCRIPT_SELECTION,
    isTranscriptSelectionCollapsed,
    type TranscriptBoundary,
    type TranscriptSelectionState,
  } from '../../transcript-indicators';
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
  export let lastActivityMarker: LastActivityMarker | null = null;
  export let chunkSelectRangeMin = 40;
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
  export let onScroll: (userInitiated?: boolean) => void;
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
  let transcriptSelection: TranscriptSelectionState = EMPTY_TRANSCRIPT_SELECTION;
  let selectionMenuPosition = { x: 0, y: 0 };
  let pointerDrag: { anchor: TranscriptBoundary; handle: 'start' | 'end' | null } | null = null;
  let removeSelectionPointerListeners: (() => void) | null = null;
  let selectionStartBoundary: TranscriptBoundary | null = null;
  let selectionEndBoundary: TranscriptBoundary | null = null;
  let selectionTopBoundary: TranscriptBoundary | null = null;
  let selectionBottomBoundary: TranscriptBoundary | null = null;
  let selectedChunkIds = new Set<number>();
  let selectionStartRole: 'top' | 'bottom' = 'top';
  let selectionEndRole: 'top' | 'bottom' = 'bottom';
  let activityAgeNow = Date.now();
  let activityAgeTimer: number | null = null;
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

  function getChunkBoundary(target: EventTarget | null, clientY: number): TranscriptBoundary | null {
    if (!(target instanceof Element)) return null;
    const chunk = target.closest<HTMLElement>('[data-transcript-chunk-id]');
    if (!chunk) return null;
    const chunkId = Number(chunk.dataset.transcriptChunkId);
    if (!Number.isFinite(chunkId)) return null;
    const rect = chunk.getBoundingClientRect();
    return { chunkId, side: clientY <= rect.top + rect.height / 2 ? 'before' : 'after' };
  }

  function getChunkBoundaryAtPoint(clientX: number, clientY: number): TranscriptBoundary | null {
    const elements = document.elementsFromPoint(clientX, clientY);
    for (const element of elements) {
      const boundary = getChunkBoundary(element, clientY);
      if (boundary) return boundary;
    }
    return null;
  }

  function clearNativeSelection(): void {
    window.getSelection()?.removeAllRanges();
  }

  function updateRangeEndpoint(boundary: TranscriptBoundary, handle: 'start' | 'end'): void {
    if (transcriptSelection.mode !== 'range') return;
    transcriptSelection = createTranscriptRangeSelection(
      handle === 'start' ? boundary : transcriptSelection.start,
      handle === 'end' ? boundary : transcriptSelection.end,
      false,
    );
  }

  function getSelectedChunkIds(): Set<number> {
    if (transcriptSelection.mode !== 'range') return new Set();
    const start = Math.min(transcriptSelection.start.chunkId, transcriptSelection.end.chunkId);
    const end = Math.max(transcriptSelection.start.chunkId, transcriptSelection.end.chunkId);
    const ids = new Set<number>();
    for (const chunk of transcript.getChunks()) {
      if (chunk.id >= start && chunk.id <= end) ids.add(chunk.id);
    }
    return ids;
  }

  function getSelectionLineCount(startChunkId: number, endChunkId: number): number {
    const first = Math.min(startChunkId, endChunkId);
    const last = Math.max(startChunkId, endChunkId);
    let lines = 0;
    for (const chunk of transcript.getChunks()) {
      if (chunk.id >= first && chunk.id <= last) lines += chunk.lineCount;
    }
    return lines;
  }

  function isChunkSelected(chunkId: number): boolean {
    return getSelectedChunkIds().has(chunkId);
  }

  function isSelectionHandle(boundary: TranscriptBoundary, handle: 'start' | 'end'): boolean {
    if (transcriptSelection.mode !== 'range') return false;
    const value = handle === 'start' ? transcriptSelection.start : transcriptSelection.end;
    return value.chunkId === boundary.chunkId && value.side === boundary.side;
  }

  function getSelectionHandleRole(handle: 'start' | 'end'): 'top' | 'bottom' {
    if (transcriptSelection.mode !== 'range') return 'top';
    const startIsTop = compareTranscriptBoundaries(
      transcriptSelection.start,
      transcriptSelection.end,
    ) <= 0;
    return handle === 'start'
      ? (startIsTop ? 'top' : 'bottom')
      : (startIsTop ? 'bottom' : 'top');
  }

  function getSelectionHandleBoundary(role: 'top' | 'bottom'): TranscriptBoundary | null {
    if (transcriptSelection.mode !== 'range') return null;
    return role === getSelectionHandleRole('start')
      ? transcriptSelection.start
      : transcriptSelection.end;
  }

  function getSelectionHandleEndpoint(role: 'top' | 'bottom'): 'start' | 'end' {
    return role === getSelectionHandleRole('start') ? 'start' : 'end';
  }

  function openSelectionMenu(event: PointerEvent | MouseEvent): void {
    selectionMenuPosition = {
      x: Math.max(8, Math.min(event.clientX, window.innerWidth - 180)),
      y: Math.max(8, Math.min(event.clientY, window.innerHeight - 90)),
    };
    if (transcriptSelection.mode === 'range') {
      transcriptSelection = { ...transcriptSelection, menuOpen: true };
    }
  }

  function removeSelectionListeners(): void {
    removeSelectionPointerListeners?.();
    removeSelectionPointerListeners = null;
  }

  function handleSelectionPointerMove(event: PointerEvent): void {
    if (!pointerDrag) return;
    let boundary = pointerDrag.handle
      ? getChunkBoundaryAtPoint(event.clientX, event.clientY)
      : getChunkBoundary(event.target, event.clientY);
    if (!boundary && transcriptHistoryScrollerElement instanceof HTMLElement) {
      const rect = transcriptHistoryScrollerElement.getBoundingClientRect();
      if (event.clientY <= rect.top + 24 && renderedChunks[0]) {
        boundary = { chunkId: renderedChunks[0].id, side: 'before' };
        transcriptHistoryScrollerElement.scrollTop -= 18;
      } else if (event.clientY >= rect.bottom - 24 && renderedChunks[renderedChunks.length - 1]) {
        boundary = { chunkId: renderedChunks[renderedChunks.length - 1].id, side: 'after' };
        transcriptHistoryScrollerElement.scrollTop += 18;
      }
    }
    if (!boundary) return;

    if (pointerDrag.handle) {
      updateRangeEndpoint(boundary, pointerDrag.handle);
      clearNativeSelection();
      return;
    }

    if (boundary.chunkId === pointerDrag.anchor.chunkId) return;
    const firstRenderedId = renderedChunks[0]?.id;
    const lastRenderedId = renderedChunks[renderedChunks.length - 1]?.id;
    const crossedVirtualWindow = boundary.chunkId === firstRenderedId || boundary.chunkId === lastRenderedId;
    const crossedConfiguredRange = getSelectionLineCount(
      pointerDrag.anchor.chunkId,
      boundary.chunkId,
    ) >= Math.max(1, Math.round(chunkSelectRangeMin));
    if (!crossedVirtualWindow && !crossedConfiguredRange) return;

    transcriptSelection = createTranscriptRangeSelection(pointerDrag.anchor, boundary);
    clearNativeSelection();
    event.preventDefault();
  }

  function handleSelectionPointerUp(event: PointerEvent): void {
    if (!pointerDrag) return;
    const wasRange = transcriptSelection.mode === 'range';
    pointerDrag = null;
    removeSelectionListeners();
    if (wasRange) {
      if (isTranscriptSelectionCollapsed(transcriptSelection)) {
        cancelTranscriptSelection();
        return;
      }
      openSelectionMenu(event);
    }
  }

  function installSelectionListeners(): void {
    removeSelectionListeners();
    window.addEventListener('pointermove', handleSelectionPointerMove, true);
    window.addEventListener('pointerup', handleSelectionPointerUp, true);
    removeSelectionPointerListeners = () => {
      window.removeEventListener('pointermove', handleSelectionPointerMove, true);
      window.removeEventListener('pointerup', handleSelectionPointerUp, true);
    };
  }

  function beginSelectionPointerDrag(event: PointerEvent): void {
    if (event.button !== 0) return;
    const boundary = getChunkBoundary(event.target, event.clientY);
    if (!boundary) return;
    pointerDrag = { anchor: boundary, handle: null };
    installSelectionListeners();
  }

  function beginSelectionHandleDrag(event: PointerEvent, handle: 'start' | 'end'): void {
    if (transcriptSelection.mode !== 'range') return;
    event.preventDefault();
    event.stopPropagation();
    pointerDrag = { anchor: handle === 'start' ? transcriptSelection.start : transcriptSelection.end, handle };
    installSelectionListeners();
  }

  async function copyTranscriptSelection(): Promise<void> {
    if (transcriptSelection.mode !== 'range') return;
    const text = getTranscriptRangeTextByChunkIds(
      transcript,
      transcriptSelection.start.chunkId,
      transcriptSelection.end.chunkId,
    );
    if (text) await copyTextToClipboard(text);
    transcriptSelection = EMPTY_TRANSCRIPT_SELECTION;
    focusElement(getScopedInputBarInputId(scope, activeBar));
  }

  function cancelTranscriptSelection(): void {
    pointerDrag = null;
    removeSelectionListeners();
    transcriptSelection = EMPTY_TRANSCRIPT_SELECTION;
    clearNativeSelection();
    closeContextMenu();
    focusElement(getScopedInputBarInputId(scope, activeBar));
  }

  function jumpToSelectionHandle(role: 'top' | 'bottom'): void {
    const boundary = getSelectionHandleBoundary(role);
    if (!boundary || !(transcriptHistoryScrollerElement instanceof HTMLElement)) return;

    let index = -1;
    for (let candidate = 0; candidate < transcript.getChunkCount(); candidate += 1) {
      if (transcript.getChunk(candidate)?.id === boundary.chunkId) {
        index = candidate;
        break;
      }
    }
    if (index < 0) return;

    const maxIndex = Math.max(1, transcript.getChunkCount() - 1);
    transcriptHistoryScrollerElement.scrollTop =
      Math.max(0, transcriptHistoryScrollerElement.scrollHeight * (index / maxIndex)
        - transcriptHistoryScrollerElement.clientHeight / 2);
    if (transcriptSelection.mode === 'range') {
      transcriptSelection = { ...transcriptSelection, menuOpen: false };
    }
  }

  function formatActivityAge(timestamp: number): string {
    const seconds = Math.max(0, Math.floor((activityAgeNow - timestamp) / 1000));
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    if (hours < 48) return 'yesterday';
    return `${Math.floor(hours / 24)}d ago`;
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

  $: selectionStartBoundary = transcriptSelection.mode === 'range'
    ? transcriptSelection.start
    : null;
  $: selectionEndBoundary = transcriptSelection.mode === 'range'
    ? transcriptSelection.end
    : null;
  $: selectionTopBoundary = transcriptSelection.mode === 'range'
    ? { chunkId: Math.min(transcriptSelection.start.chunkId, transcriptSelection.end.chunkId), side: 'before' }
    : null;
  $: selectionBottomBoundary = transcriptSelection.mode === 'range'
    ? { chunkId: Math.max(transcriptSelection.start.chunkId, transcriptSelection.end.chunkId), side: 'after' }
    : null;
  $: selectionStartRole = transcriptSelection.mode === 'range'
    ? compareTranscriptBoundaries(transcriptSelection.start, transcriptSelection.end) <= 0 ? 'top' : 'bottom'
    : 'top';
  $: selectionEndRole = transcriptSelection.mode === 'range'
    ? selectionStartRole === 'top' ? 'bottom' : 'top'
    : 'bottom';
  $: selectedChunkIds = transcriptSelection.mode === 'range'
    ? getSelectedChunkIds()
    : new Set<number>();

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

    if (transcriptSelection.mode === 'range') {
      return;
    }

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
    if (transcriptSelection.mode === 'range') {
      transcriptSelection = { ...transcriptSelection, menuOpen: false };
    }

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
    const wasUserScrollIntent = userScrollIntent;
    let nextUserScrolled = userScrolled;
    if (wasUserScrollIntent && outputEl instanceof HTMLElement) {
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
    onScroll(wasUserScrollIntent);
    syncTranscriptRenderState();

    // Let the parent update userScrolled before recalculating the virtualized
    // range. If virtualization runs first while userScrolled is false, it
    // anchors the range to the bottom and makes an upward scroll look like a
    // no-op. The second check also lets split view collapse after the new
    // range has been applied when the user reaches the real bottom.
    void nextFrame().then(() => {
      syncTranscriptRenderState();

      // Virtualization can change scrollHeight after the initial scroll event.
      // Re-read the settled element so a user scroll that reached the real
      // bottom can clear split mode even when the first measurement was stale.
      if (wasUserScrollIntent) {
        const settledOutput = document.getElementById(`${scope}-output-area`);
        if (settledOutput instanceof HTMLElement) {
          const settledUserScrolled = settledOutput.scrollHeight
            - settledOutput.scrollTop
            - settledOutput.clientHeight > 2;

          if (settledUserScrolled !== userScrolled) {
            userScrolled = settledUserScrolled;
            onScroll(true);
          }
        }
      }

      onScroll(false);
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

    if (isScrollingDown && isAtBottom && userScrolled) {
      // A stale split state can leave the history pane at the bottom already.
      // Treat a downward wheel there as an explicit request to resume following
      // the live output, even though it produces no native scroll event.
      userScrollIntent = false;
      userScrolled = false;
      onScroll(true);
      syncTranscriptRenderState();
      return;
    }

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

    beginSelectionPointerDrag(event as PointerEvent);
  }

  function handleScrollToBottomClick(): void {
    // The button is an explicit request to resume following the live output.
    // Clear the local copy immediately so split view cannot remain mounted
    // while the parent store update and Dockview workspace sync are settling.
    userScrollIntent = false;
    userScrolled = false;
    onScrollToBottom();

    void tick().then(() => {
      if (transcriptDestroyed) {
        return;
      }

      userScrollIntent = false;
      userScrolled = false;
      scrollElementToBottom(`${scope}-output-area`);
      syncTranscriptScrollMetrics();
      syncTranscriptRenderState();
    });
  }

  function handleContextMenu(event: MouseEvent): void {
    if (transcriptSelection.mode === 'range') {
      event.preventDefault();
      event.stopPropagation();
      openSelectionMenu(event);
      return;
    }
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

    const isAtBottom = mainOutput.scrollTop + mainOutput.clientHeight >= mainOutput.scrollHeight - 1;
    if (delta > 0 && isAtBottom && userScrolled) {
      // The live pane forwards wheel input, but a downward wheel at the bottom
      // cannot generate a scroll event for the history pane to observe.
      userScrollIntent = false;
      userScrolled = false;
      onScroll(true);
      syncTranscriptRenderState();
      return;
    }

    logTranscriptDiagnostics('live wheel forward', {
      scope,
      delta,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
    });

    userScrollIntent = true;
    scrollElementBy(mainOutputId, delta);
  }

  onMount(() => {
    syncTranscriptZoomListener();
    activityAgeTimer = window.setInterval(() => {
      activityAgeNow = Date.now();
    }, 30_000);

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
      if (activityAgeTimer !== null) {
        window.clearInterval(activityAgeTimer);
        activityAgeTimer = null;
      }
    };
  });

  onDestroy(() => {
    transcriptDestroyed = true;
    transcriptSelection = EMPTY_TRANSCRIPT_SELECTION;
    pointerDrag = null;
    removeSelectionListeners();
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
          {#if lastActivityMarker?.boundary.chunkId === renderedChunk.id && lastActivityMarker.boundary.side === 'before'}
            <div class="transcript-interface-indicator transcript-last-activity" role="status">
              Last activity {formatActivityAge(lastActivityMarker.timestamp)}
            </div>
          {/if}
          {#if selectionTopBoundary?.chunkId === renderedChunk.id}
            <div class="transcript-selection-overlay-anchor transcript-selection-overlay-anchor--top">
              <div class="transcript-selection-action-row" aria-label="Top selection actions">
                <button type="button" class="transcript-selection-handle transcript-selection-handle--top" aria-label="Move top selection handle" on:mousedown={(event) => beginSelectionHandleDrag(event as unknown as PointerEvent, getSelectionHandleEndpoint('top'))}></button>
                <div class="transcript-selection-action-buttons">
                  <button type="button" class="transcript-selection-action-button--icon" aria-label="Go to lower handle" title="Go to lower handle" on:mousedown|stopPropagation on:click|stopPropagation={() => jumpToSelectionHandle('bottom')}>↓</button>
                  <button type="button" aria-label="Copy selection" title="Copy selection" on:mousedown|stopPropagation on:click|stopPropagation={() => void copyTranscriptSelection()}>⧉ <span>Copy</span></button>
                  <button type="button" aria-label="Cancel long selection" title="Cancel long selection" on:mousedown|stopPropagation on:click|stopPropagation={cancelTranscriptSelection}>× <span>Cancel</span></button>
                </div>
              </div>
            </div>
          {/if}
          <div class:transcript-selection-chunk={selectedChunkIds.has(renderedChunk.id)} class="output-chunk" data-transcript-chunk-id={renderedChunk.id} title={renderedChunk.title}>{@html renderedChunk.html}</div>
          {#if selectionBottomBoundary?.chunkId === renderedChunk.id}
            <div class="transcript-selection-overlay-anchor transcript-selection-overlay-anchor--bottom">
              <div class="transcript-selection-action-row" aria-label="Bottom selection actions">
                <button type="button" class="transcript-selection-handle transcript-selection-handle--bottom" aria-label="Move bottom selection handle" on:mousedown={(event) => beginSelectionHandleDrag(event as unknown as PointerEvent, getSelectionHandleEndpoint('bottom'))}></button>
                <div class="transcript-selection-action-buttons">
                  <button type="button" class="transcript-selection-action-button--icon" aria-label="Go to upper handle" title="Go to upper handle" on:mousedown|stopPropagation on:click|stopPropagation={() => jumpToSelectionHandle('top')}>↑</button>
                  <button type="button" aria-label="Copy selection" title="Copy selection" on:mousedown|stopPropagation on:click|stopPropagation={() => void copyTranscriptSelection()}>⧉ <span>Copy</span></button>
                  <button type="button" aria-label="Cancel long selection" title="Cancel long selection" on:mousedown|stopPropagation on:click|stopPropagation={cancelTranscriptSelection}>× <span>Cancel</span></button>
                </div>
              </div>
            </div>
          {/if}
          {#if lastActivityMarker?.boundary.chunkId === renderedChunk.id && lastActivityMarker.boundary.side === 'after'}
            <div class="transcript-interface-indicator transcript-last-activity" role="status">
              Last activity {formatActivityAge(lastActivityMarker.timestamp)}
            </div>
          {/if}
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

  {#if transcriptSelection.mode === 'range' && transcriptSelection.menuOpen}
    <div
      class="transcript-selection-menu"
      style={`left: ${selectionMenuPosition.x}px; top: ${selectionMenuPosition.y}px;`}
      role="menu"
      aria-label="Transcript selection actions"
    >
      <button type="button" role="menuitem" on:click={() => jumpToSelectionHandle('bottom')}>↓ Go to lower handle</button>
      <button type="button" role="menuitem" on:click={() => jumpToSelectionHandle('top')}>↑ Go to upper handle</button>
      <button type="button" role="menuitem" on:click={() => void copyTranscriptSelection()}>Copy selection</button>
      <button type="button" role="menuitem" on:click={cancelTranscriptSelection}>Cancel selection</button>
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

<style>
  .transcript-interface-indicator {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    min-height: 1.5rem;
    margin: 0.25rem 0;
    padding: 0.15rem 0.6rem;
    border: 1px solid var(--dv-activegroup-visiblepanel-tab-background, var(--color-accent, #6688cc));
    border-radius: 0.25rem;
    background: var(--dv-group-view-background, rgba(80, 110, 170, 0.18));
    color: var(--dv-activegroup-visiblepanel-tab-color, currentColor);
    font: 0.8rem var(--font-ui, sans-serif);
    pointer-events: none;
  }

  .transcript-last-activity::before {
    content: '';
    width: 0.45rem;
    height: 0.45rem;
    margin-right: 0.45rem;
    border-radius: 50%;
    background: currentColor;
  }

  .transcript-selection-chunk {
    outline: 1px solid color-mix(in srgb, currentColor 45%, transparent);
    border-left: 2px solid var(--dv-activegroup-visiblepanel-tab-background, #6688cc);
    background: color-mix(in srgb, currentColor 10%, transparent);
  }

  .output-area-content {
    position: relative;
  }

  .transcript-selection-overlay-anchor {
    position: relative;
    z-index: 4;
    height: 0;
    pointer-events: none;
  }

  .transcript-selection-action-row {
    position: absolute;
    top: 0;
    left: 0.35rem;
    width: calc(100% - 0.35rem);
    height: 0;
    pointer-events: auto;
  }

  .transcript-selection-overlay-anchor--top .transcript-selection-action-row {
    transform: translateY(-50%);
  }

  .transcript-selection-handle {
    position: absolute;
    top: 0;
    left: 0;
    transform: translateY(-50%);
    width: 50%;
    /* Keep the line narrow visually, but make the whole line-height above
       and below it draggable. This is especially important when adjacent
       chunks are only one transcript line tall. */
    height: calc(2 * 1.55em);
    margin: 0;
    padding: 0;
    border: 0;
    border-radius: 0.2rem;
    background: transparent;
    color: var(--dv-activegroup-visiblepanel-tab-background, #6688cc);
    cursor: ns-resize;
  }

  .transcript-selection-handle::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 0.35rem;
    transform: translateY(-50%);
    border-radius: 0.2rem;
    background: var(--dv-activegroup-visiblepanel-tab-background, #6688cc);
    pointer-events: none;
  }

  .transcript-selection-action-buttons {
    position: absolute;
    top: 0;
    left: 0.2rem;
    display: flex;
    gap: 0.2rem;
    transform: translateY(-50%);
  }

  .transcript-selection-action-buttons button {
    min-width: 1.2rem;
    height: 1.35rem;
    padding: 0.1rem 0.4rem;
    border: 1px solid currentColor;
    border-radius: 0.25rem;
    background: var(--dv-group-view-background, #222);
    color: inherit;
    line-height: 1;
    cursor: pointer;
  }

  .transcript-selection-action-buttons .transcript-selection-action-button--icon {
    width: 1.35rem;
    padding: 0.1rem;
  }

  .transcript-selection-action-buttons button:hover,
  .transcript-selection-action-buttons button:focus-visible {
    background: color-mix(in srgb, currentColor 15%, transparent);
  }

  .transcript-selection-menu {
    position: fixed;
    z-index: 100;
    display: grid;
    gap: 0.15rem;
    min-width: 9rem;
    padding: 0.25rem;
    border: 1px solid var(--dv-activegroup-visiblepanel-tab-background, #6688cc);
    border-radius: 0.25rem;
    background: var(--dv-group-view-background, #222);
    box-shadow: 0 0.3rem 1rem rgba(0, 0, 0, 0.35);
  }

  .transcript-selection-menu button {
    padding: 0.3rem 0.5rem;
    border: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    cursor: pointer;
  }

  .transcript-selection-menu button:hover,
  .transcript-selection-menu button:focus-visible {
    background: color-mix(in srgb, currentColor 15%, transparent);
  }
</style>
