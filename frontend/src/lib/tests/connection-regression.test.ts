import assert from 'node:assert/strict';
import test from 'node:test';
import { acceptsConnectionSequence } from '../connection';

test('connection replay/live ordering rejects duplicates and stale events', () => {
  assert.equal(acceptsConnectionSequence(0, 1), true);
  assert.equal(acceptsConnectionSequence(1, 1), false);
  assert.equal(acceptsConnectionSequence(4, 3), false);
  assert.equal(acceptsConnectionSequence(4, 5), true);
  assert.equal(acceptsConnectionSequence(4, undefined), true);
});
