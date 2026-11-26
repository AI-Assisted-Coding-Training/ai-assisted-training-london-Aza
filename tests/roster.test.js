import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildRoster } from '../app/roster.js';

const state = {
  type: 'state',
  hostId: 'user-abc123',
  users: [
    { id: 'user-abc123', name: 'Alice', hasVoted: false },
    { id: 'user-def456', name: 'Bob', hasVoted: false },
  ],
};

test('the roster lists every participant from the state message', () => {
  const roster = buildRoster('user-def456', state);
  assert.equal(roster.length, 2);
});

test('the roster marks which participant is me', () => {
  const roster = buildRoster('user-def456', state);
  const me = roster.find((p) => p.id === 'user-def456');
  const other = roster.find((p) => p.id === 'user-abc123');
  assert.equal(me.isMe, true);
  assert.equal(other.isMe, false);
});

test('the roster marks which participant is the host', () => {
  const roster = buildRoster('user-def456', state);
  const host = roster.find((p) => p.id === 'user-abc123');
  const nonHost = roster.find((p) => p.id === 'user-def456');
  assert.equal(host.isHost, true);
  assert.equal(nonHost.isHost, false);
});

test('participants with unique names get a plain display label', () => {
  const roster = buildRoster('user-def456', state);
  const alice = roster.find((p) => p.id === 'user-abc123');
  assert.equal(alice.displayLabel, 'Alice');
});

test('participants who share a display name are disambiguated with a suffix', () => {
  const duplicateState = {
    type: 'state',
    hostId: 'user-abc123',
    users: [
      { id: 'user-abc123', name: 'Alice', hasVoted: false },
      { id: 'user-def456', name: 'Alice', hasVoted: false },
    ],
  };
  const roster = buildRoster('user-def456', duplicateState);
  const labels = roster.map((p) => p.displayLabel);
  assert.notEqual(labels[0], labels[1]);
  for (const label of labels) {
    assert.match(label, /^Alice #[0-9a-z]{4}$/);
  }
});
