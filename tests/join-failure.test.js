import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describeJoinFailure } from '../app/join-failure.js';

test('a malformed room id gets a distinct invalid-link message', () => {
  const message = describeJoinFailure('not a valid room id');
  assert.match(message, /invalid|not.*valid/i);
});

test('a well-formed room id that still failed to connect gets a generic message', () => {
  const message = describeJoinFailure('xk29-4plm');
  assert.match(message, /full|unavailable|no longer/i);
});
