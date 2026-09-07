export type TranscriptBoundarySide = 'before' | 'after';

export interface TranscriptBoundary {
  chunkId: number;
  side: TranscriptBoundarySide;
}

export interface LastActivityMarker {
  boundary: TranscriptBoundary;
  timestamp: number;
}

export type TranscriptIndicatorDismissReason =
  | 'explicit-navigation'
  | 'copy'
  | 'cancel'
  | 'new-selection'
  | 'tab-change'
  | 'surface-destroyed'
  | 'content-trimmed'
  | 'transcript-reset';

export type TranscriptSelectionState =
  | { mode: 'none' }
  | {
      mode: 'range';
      start: TranscriptBoundary;
      end: TranscriptBoundary;
      direction: 'forward' | 'backward';
      clamped: boolean;
      menuOpen: boolean;
    };

export const EMPTY_TRANSCRIPT_SELECTION: TranscriptSelectionState = { mode: 'none' };

export function compareTranscriptBoundaries(
  left: TranscriptBoundary,
  right: TranscriptBoundary,
): number {
  if (left.chunkId !== right.chunkId) {
    return left.chunkId - right.chunkId;
  }

  return boundaryRank(left.side) - boundaryRank(right.side);
}

function boundaryRank(side: TranscriptBoundarySide): number {
  return side === 'before' ? 0 : 1;
}

export function createTranscriptRangeSelection(
  start: TranscriptBoundary,
  end: TranscriptBoundary,
  menuOpen = false,
): TranscriptSelectionState {
  return {
    mode: 'range',
    start,
    end,
    direction: compareTranscriptBoundaries(start, end) <= 0 ? 'forward' : 'backward',
    clamped: false,
    menuOpen,
  };
}

export function setTranscriptSelectionMenuOpen(
  selection: TranscriptSelectionState,
  menuOpen: boolean,
): TranscriptSelectionState {
  if (selection.mode === 'none') {
    return selection;
  }

  return { ...selection, menuOpen };
}

export function isTranscriptSelectionCollapsed(selection: TranscriptSelectionState): boolean {
  return selection.mode === 'range'
    && compareTranscriptBoundaries(selection.start, selection.end) === 0;
}

export function isLastActivityDismissedBy(
  reason: TranscriptIndicatorDismissReason,
): boolean {
  return reason === 'explicit-navigation'
    || reason === 'content-trimmed'
    || reason === 'transcript-reset'
    || reason === 'tab-change'
    || reason === 'surface-destroyed';
}

export function isTranscriptSelectionDismissedBy(
  reason: TranscriptIndicatorDismissReason,
): boolean {
  return reason === 'copy'
    || reason === 'cancel'
    || reason === 'new-selection'
    || reason === 'tab-change'
    || reason === 'surface-destroyed'
    || reason === 'content-trimmed'
    || reason === 'transcript-reset';
}

export function reconcileLastActivityMarker(
  marker: LastActivityMarker | null,
  retainedChunkIds: ReadonlySet<number>,
): LastActivityMarker | null {
  if (!marker || retainedChunkIds.has(marker.boundary.chunkId)) {
    return marker;
  }

  return null;
}

export function reconcileTranscriptSelection(
  selection: TranscriptSelectionState,
  retainedChunkIds: ReadonlySet<number>,
): TranscriptSelectionState {
  if (selection.mode === 'none') {
    return selection;
  }

  if (!retainedChunkIds.has(selection.start.chunkId) || !retainedChunkIds.has(selection.end.chunkId)) {
    return EMPTY_TRANSCRIPT_SELECTION;
  }

  return selection;
}
