/// <reference types="node" />

import assert from 'node:assert/strict';
import test from 'node:test';

import { supportsFuzzball, supportsTaps } from '../world-capabilities.js';
import type { WorldRecord } from '../types.js';

function world(compatibility: string): WorldRecord {
  return {
    id: `world-${compatibility}`,
    name: compatibility,
    host: 'localhost',
    port: 4200,
    tls: false,
    verifyCertificate: false,
    compatibility: compatibility as WorldRecord['compatibility'],
  };
}

test('taps inherits fuzzball capability without becoming fuzzball-only', () => {
  assert.equal(supportsFuzzball(world('fuzzball')), true);
  assert.equal(supportsFuzzball(world('taps')), true);
  assert.equal(supportsFuzzball(world('telnet')), false);
  assert.equal(supportsTaps(world('fuzzball')), false);
  assert.equal(supportsTaps(world('taps')), true);
});

test('capability helpers tolerate an unavailable world', () => {
  assert.equal(supportsFuzzball(null), false);
  assert.equal(supportsTaps(undefined), false);
});
