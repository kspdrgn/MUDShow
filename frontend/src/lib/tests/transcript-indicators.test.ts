import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyLastActivityMarkerWorkspaceState,
  EMPTY_TRANSCRIPT_SELECTION,
  createTranscriptRangeSelection,
  isLastActivityDismissedBy,
  isTranscriptSelectionCollapsed,
  isTranscriptSelectionDismissedBy,
  reconcileLastActivityMarker,
  reconcileTranscriptSelection,
  type LastActivityMarker,
} from '../transcript-indicators';

const retained = new Set([10, 11, 12]);

test('workspace updates deliver the last-activity marker to the mounted transcript', () => {
  const marker: LastActivityMarker = {
    boundary: { chunkId: 11, side: 'before' },
    timestamp: 123,
  };

  assert.deepEqual(
    applyLastActivityMarkerWorkspaceState(null, { lastActivityMarker: marker }),
    marker,
  );
  assert.equal(
    applyLastActivityMarkerWorkspaceState(marker, { lastActivityMarker: null }),
    null,
  );
  assert.deepEqual(
    applyLastActivityMarkerWorkspaceState(marker, { hasNewActivity: false }),
    marker,
  );
});

test('range selection records direction and keeps the menu state separate', () => {
  const selection = createTranscriptRangeSelection(
    { chunkId: 12, side: 'after' },
    { chunkId: 10, side: 'before' },
    true,
  );

  assert.equal(selection.mode, 'range');
  assert.equal(selection.direction, 'backward');
  assert.equal(selection.menuOpen, true);
  assert.equal(selection.clamped, false);
});

test('last-activity dismissal is limited to navigation and content lifecycle changes', () => {
  assert.equal(isLastActivityDismissedBy('explicit-navigation'), true);
  assert.equal(isLastActivityDismissedBy('content-trimmed'), true);
  assert.equal(isLastActivityDismissedBy('copy'), false);
  assert.equal(isLastActivityDismissedBy('cancel'), false);
});

test('selection dismissal includes commit, cancel, replacement, and lifecycle changes', () => {
  assert.equal(isTranscriptSelectionDismissedBy('copy'), true);
  assert.equal(isTranscriptSelectionDismissedBy('cancel'), true);
  assert.equal(isTranscriptSelectionDismissedBy('new-selection'), true);
  assert.equal(isTranscriptSelectionDismissedBy('explicit-navigation'), false);
});

test('markers survive virtualization but disappear when their content is trimmed', () => {
  const marker: LastActivityMarker = {
    boundary: { chunkId: 11, side: 'before' },
    timestamp: 123,
  };

  assert.deepEqual(reconcileLastActivityMarker(marker, retained), marker);
  assert.equal(reconcileLastActivityMarker(marker, new Set([12])), null);
});

test('a selection is canceled when either endpoint is no longer retained', () => {
  const selection = createTranscriptRangeSelection(
    { chunkId: 10, side: 'after' },
    { chunkId: 12, side: 'before' },
  );

  assert.deepEqual(reconcileTranscriptSelection(selection, retained), selection);
  assert.deepEqual(
    reconcileTranscriptSelection(selection, new Set([11, 12])),
    EMPTY_TRANSCRIPT_SELECTION,
  );
});

test('crossed handles remain a live range until both endpoints coincide', () => {
  const crossed = createTranscriptRangeSelection(
    { chunkId: 12, side: 'after' },
    { chunkId: 10, side: 'before' },
  );
  const collapsed = createTranscriptRangeSelection(
    { chunkId: 11, side: 'after' },
    { chunkId: 11, side: 'after' },
  );

  assert.equal(isTranscriptSelectionCollapsed(crossed), false);
  assert.equal(isTranscriptSelectionCollapsed(collapsed), true);
});
