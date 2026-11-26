import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeJoinOutcome } from '../app/join-outcome.js';

test('the first time joining a session has no rejoin notice', () => {
  assert.equal(describeJoinOutcome({ isReconnect: false }), null);
});

test('rejoining after a lost connection shows a distinct notice', () => {
  const message = describeJoinOutcome({ isReconnect: true });
  assert.match(message, /rejoin/i);
  assert.match(message, /new participant/i);
});
