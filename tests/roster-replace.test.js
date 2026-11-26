import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoster } from '../app/roster.js';

test('a participant missing from a later state snapshot is not carried over', () => {
  const firstState = {
    hostId: 'user-abc123',
    users: [
      { id: 'user-abc123', name: 'Alice', hasVoted: false },
      { id: 'user-def456', name: 'Bob', hasVoted: false },
    ],
  };
  const laterState = {
    hostId: 'user-abc123',
    users: [{ id: 'user-abc123', name: 'Alice', hasVoted: false }],
  };

  buildRoster('user-abc123', firstState);
  const roster = buildRoster('user-abc123', laterState);

  assert.equal(roster.length, 1);
  assert.equal(roster.some((p) => p.id === 'user-def456'), false);
});
