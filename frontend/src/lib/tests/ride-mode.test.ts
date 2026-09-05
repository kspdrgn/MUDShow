/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createRideModeQuery,
  createRideModeUpdate,
  parseRideMode,
} from '../taps/ride-mode.js';

test('ride mode parser accepts the four known modes case-insensitively', () => {
  assert.equal(parseRideMode('ride'), 'ride');
  assert.equal(parseRideMode(' HAND '), 'hand');
  assert.equal(parseRideMode('Walk'), 'walk');
  assert.equal(parseRideMode('FLY'), 'fly');
});

test('ride mode parser rejects unavailable and unknown values', () => {
  assert.equal(parseRideMode(null), null);
  assert.equal(parseRideMode(''), null);
  assert.equal(parseRideMode('swim'), null);
});

test('ride mode commands target the Taps property', () => {
  assert.equal(createRideModeQuery(), 'examine me=/ride/_mode\r\n');
  assert.equal(createRideModeUpdate('walk'), '@set me=/ride/_mode:walk\r\n');
});
