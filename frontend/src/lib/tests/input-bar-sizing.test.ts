/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { calculateInputBarHeight } from '../input-bar-sizing.js';

const base = { lineHeight: 20, verticalPadding: 12 };

test('keeps an empty input at its manual minimum', () => {
  const result = calculateInputBarHeight({ ...base, lines: 2, contentHeight: 12 });
  assert.equal(result.manualMinimumHeight, 52);
  assert.equal(result.effectiveHeight, 52);
  assert.equal(result.shouldScroll, false);
});

test('expands to fit content below the automatic maximum', () => {
  const result = calculateInputBarHeight({ ...base, lines: 1, contentHeight: 72 });
  assert.equal(result.effectiveHeight, 72);
  assert.equal(result.shouldScroll, false);
});

test('caps automatic growth at six lines and enables scrolling', () => {
  const result = calculateInputBarHeight({ ...base, lines: 1, contentHeight: 180 });
  assert.equal(result.automaticMaximumHeight, 132);
  assert.equal(result.effectiveHeight, 132);
  assert.equal(result.shouldScroll, true);
});

test('honors a manual minimum above the automatic maximum', () => {
  const result = calculateInputBarHeight({ ...base, lines: 8, contentHeight: 180 });
  assert.equal(result.manualMinimumHeight, 172);
  assert.equal(result.effectiveHeight, 172);
  assert.equal(result.shouldScroll, true);
});

test('contracts when content is deleted while retaining the manual minimum', () => {
  const result = calculateInputBarHeight({ ...base, lines: 3, contentHeight: 20 });
  assert.equal(result.effectiveHeight, 72);
  assert.equal(result.shouldScroll, false);
});
