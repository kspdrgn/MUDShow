import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PlayTranscript,
  TranscriptHeightIndex,
  appendTranscriptHistory,
  getTranscriptRangeText,
  trimTranscriptHistory,
} from '../playback';

test('history append and trimming keep the newest configured lines', () => {
  let history = appendTranscriptHistory([], 'one\ntwo\n', 3);
  history = appendTranscriptHistory(history, 'three\nfour\n', 3);

  assert.deepEqual(history.map((entry) => entry.text), ['three\nfour\n']);
  assert.equal(history.reduce((total, entry) => total + entry.lines, 0), 2);
  assert.deepEqual(trimTranscriptHistory(history, 0), []);
});

test('height index locates a bounded range without scanning every chunk', () => {
  const index = new TranscriptHeightIndex();
  index.append(10, 20);
  index.append(11, 30);
  index.append(12, 40);
  index.append(13, 50);

  assert.equal(index.totalHeight, 140);
  assert.deepEqual(index.getRange(45, 30, 0), {
    startIndex: 1,
    endIndex: 3,
    topSpacer: 20,
    bottomSpacer: 50,
  });

  index.trimFront(2);
  index.append(14, 60);
  assert.equal(index.getId(0), 12);
  assert.equal(index.totalHeight, 150);
  assert.deepEqual(index.getRange(0, 20, 0, true), {
    startIndex: 2,
    endIndex: 3,
    topSpacer: 90,
    bottomSpacer: 0,
  });
});

test('canonical transcript range extraction crosses virtualized boundaries', () => {
  const transcript = new PlayTranscript(10);
  transcript.append('zero\n');
  transcript.append('one\n');
  transcript.append('two\n');
  transcript.append('three\n');

  assert.equal(getTranscriptRangeText(transcript, 1, 3), 'one\ntwo\nthree\n');
  assert.equal(getTranscriptRangeText(transcript, 3, 1), 'one\ntwo\nthree\n');
});
