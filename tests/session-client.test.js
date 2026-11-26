import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionClient } from '../app/session-client.js';

// Minimal hand-rolled WebSocket fake, used only in tests (no new dependency).
class FakeWebSocket {
  static OPEN = 1;

  constructor(url) {
    this.url = url;
    this.readyState = FakeWebSocket.OPEN;
    this.sent = [];
    FakeWebSocket.instances.push(this);
  }
  send(data) {
    this.sent.push(JSON.parse(data));
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ code: 1000 });
  }
}

function send(socket, message) {
  socket.onmessage({ data: JSON.stringify(message) });
}

test('joining, losing connection, and reconnecting reports status, roster and rejoin notice correctly', () => {
  FakeWebSocket.instances = [];
  const events = [];
  const scheduledReconnects = [];

  createSessionClient({
    url: 'wss://example.com/ws?room=xk29-4plm&name=Alice',
    roomId: 'xk29-4plm',
    WebSocketImpl: FakeWebSocket,
    scheduleReconnect: (fn, delay) => scheduledReconnects.push({ fn, delay }),
    onStatusChange: (status, payload) => events.push({ status, payload }),
  });

  assert.equal(events[0].status, 'connecting');

  const firstSocket = FakeWebSocket.instances[0];
  send(firstSocket, { type: 'welcome', userId: 'user-abc123' });
  send(firstSocket, {
    type: 'state',
    hostId: 'user-abc123',
    users: [{ id: 'user-abc123', name: 'Alice', hasVoted: false }],
  });

  const firstJoined = events.find((e) => e.status === 'joined');
  assert.equal(firstJoined.payload.outcomeMessage, null);
  const firstRoster = events.find((e) => e.status === 'roster');
  assert.equal(firstRoster.payload.roster[0].isMe, true);
  assert.equal(firstRoster.payload.roster[0].isHost, true);

  // Connection drops unexpectedly.
  firstSocket.onclose({ code: 1006 });
  assert.equal(events.at(-1).status, 'reconnecting');
  assert.equal(scheduledReconnects.length, 1);
  assert.equal(scheduledReconnects[0].delay, 2000);

  // The scheduled reconnect attempt fires and succeeds as a new participant.
  scheduledReconnects[0].fn();
  const secondSocket = FakeWebSocket.instances[1];
  send(secondSocket, { type: 'welcome', userId: 'user-xyz999' });
  send(secondSocket, {
    type: 'state',
    hostId: 'user-xyz999',
    users: [{ id: 'user-xyz999', name: 'Alice', hasVoted: false }],
  });

  const rejoined = events.filter((e) => e.status === 'joined').at(-1);
  assert.match(rejoined.payload.outcomeMessage, /rejoin/i);
  const secondRoster = events.filter((e) => e.status === 'roster').at(-1);
  assert.equal(secondRoster.payload.roster[0].isMe, true);
  assert.equal(secondRoster.payload.roster[0].isHost, true);
});

const alice = { id: 'alice', name: 'Alice', hasVoted: false };
const bob = { id: 'bob', name: 'Bob', hasVoted: false };

function voteState(socket, users, options = {}) {
  send(socket, { type: 'state', hostId: alice.id, revealed: false, votes: null, users, ...options });
}

function votingSession() {
  const events = [];
  const reconnects = [];
  const client = createSessionClient({
    url: 'wss://example.com/ws?room=xk29-4plm&name=Alice',
    roomId: 'xk29-4plm',
    WebSocketImpl: FakeWebSocket,
    scheduleReconnect: (fn) => reconnects.push(fn),
    onStatusChange: (status, payload) => events.push({ status, payload }),
  });
  const socket = FakeWebSocket.instances.at(-1);
  const latest = (status) => events.findLast((event) => event.status === status)?.payload;
  send(socket, { type: 'welcome', userId: alice.id });
  voteState(socket, [alice, bob]);
  return { client, socket, latest, reconnects };
}

test('casting and changing a vote sends string values and highlights only the local choice', () => {
  const { client, socket, latest } = votingSession();

  client.vote('0');
  assert.equal(latest('voting').selectedVote, '0');
  assert.equal(latest('roster').votedCount, 0);

  voteState(socket, [{ ...alice, hasVoted: true }, bob]);
  client.vote('8');
  voteState(socket, [{ ...alice, hasVoted: true }, bob]);

  assert.deepEqual(socket.sent, [{ type: 'vote', value: '0' }, { type: 'vote', value: '8' }]);
  assert.equal(latest('voting').selectedVote, '8');
  assert.equal(latest('roster').votedCount, 1);
});

test('voted indicators and progress follow full snapshots as participants vote and leave', () => {
  const { socket, latest } = votingSession();
  const votedBob = { ...bob, hasVoted: true };
  voteState(socket, [alice, votedBob]);

  const { roster, votedCount } = latest('roster');
  assert.equal(votedCount, 1);
  assert.deepEqual(roster.map(({ name, hasVoted }) => [name, hasVoted]), [
    ['Alice', false],
    ['Bob', true],
  ]);
  assert.equal(latest('voting').selectedVote, null);

  voteState(socket, [alice]);
  assert.equal(latest('roster').votedCount, 0);
  assert.equal(latest('roster').roster.length, 1);
});

test('reveal locks voting and reset clears the selection', () => {
  const { client, socket, latest } = votingSession();
  client.vote('5');
  const users = [{ ...alice, hasVoted: true }, { ...bob, hasVoted: true }];
  const votes = { alice: '5', bob: '8' };
  voteState(socket, users, { revealed: true, votes });

  assert.equal(latest('voting').revealed, true);
  assert.equal(latest('voting').canVote, false);
  assert.equal(latest('voting').selectedVote, '5');
  client.vote('8');
  assert.deepEqual(socket.sent, [{ type: 'vote', value: '5' }]);

  voteState(socket, [alice, bob]);
  assert.equal(latest('voting').canVote, true);
  assert.equal(latest('voting').selectedVote, null);
});

test('a rejected change clears the highlight without changing confirmed progress', () => {
  const { client, socket, latest } = votingSession();
  client.vote('5');
  voteState(socket, [{ ...alice, hasVoted: true }, bob]);
  client.vote('8');
  send(socket, { type: 'error', message: 'Rate limit exceeded' });

  assert.equal(latest('error').message, 'Rate limit exceeded');
  assert.equal(latest('voting').selectedVote, null);
  assert.equal(latest('roster').votedCount, 1);
  assert.equal(latest('roster').roster[0].hasVoted, true);
});

test('a disconnect disables voting and a fresh connection starts without the old selection', () => {
  const { client, socket, latest, reconnects } = votingSession();
  client.vote('5');
  socket.readyState = 3;
  socket.onclose({ code: 1006 });
  assert.equal(latest('voting').canVote, false);
  client.vote('8');
  assert.deepEqual(socket.sent, [{ type: 'vote', value: '5' }]);

  reconnects[0]();
  const nextSocket = FakeWebSocket.instances.at(-1);
  const newAlice = { ...alice, id: 'alice-rejoined' };
  send(nextSocket, { type: 'welcome', userId: newAlice.id });
  assert.equal(latest('voting').canVote, false);
  voteState(nextSocket, [newAlice, { ...bob, hasVoted: true }], { hostId: bob.id });
  assert.equal(latest('voting').canVote, true);
  assert.equal(latest('voting').selectedVote, null);
  assert.equal(latest('roster').votedCount, 1);
});

test('the current host can send either round action before or after reveal', () => {
  const { client, socket, latest } = votingSession();

  assert.equal(latest('round').canManageRound, true);
  client.reset();
  client.reveal();
  assert.deepEqual(socket.sent, [{ type: 'reset' }, { type: 'reveal' }]);
  assert.equal(latest('round').results, null);

  voteState(socket, [alice, bob], { revealed: true, votes: {} });
  assert.equal(latest('round').canManageRound, true);
  client.reveal();
  client.reset();
  assert.deepEqual(socket.sent.slice(2), [{ type: 'reveal' }, { type: 'reset' }]);
  assert.notEqual(latest('round').results, null);

  voteState(socket, [alice, bob]);
  assert.equal(latest('round').results, null);
  assert.equal(latest('voting').canVote, true);
});

test('round controls follow host promotion and are unavailable while reconnecting', () => {
  const { client, socket, latest } = votingSession();
  voteState(socket, [alice, bob], { hostId: bob.id });
  assert.equal(latest('round').canManageRound, false);
  client.reveal();
  client.reset();
  assert.deepEqual(socket.sent, []);

  voteState(socket, [alice]);
  assert.equal(latest('round').canManageRound, true);
  client.reveal();
  assert.deepEqual(socket.sent, [{ type: 'reveal' }]);

  socket.close();
  assert.equal(latest('round').canManageRound, false);
  assert.equal(latest('round').results, null);
});

test('results are private until reveal, then list each participant and all tied estimates', () => {
  const { socket, latest } = votingSession();
  const carol = { id: 'carol', name: 'Carol', hasVoted: false };
  const participants = [{ ...alice, hasVoted: true }, { ...bob, hasVoted: true }, carol];
  const votes = { bob: '8', alice: '5' };

  voteState(socket, participants, { votes });
  assert.equal(latest('round').results, null);
  voteState(socket, participants, { revealed: true, votes });
  const { participants: results, mostCommonVotes } = latest('round').results;
  assert.deepEqual(results.map(({ displayLabel, value }) => [displayLabel, value]), [
    ['Alice', '5'], ['Bob', '8'], ['Carol', null],
  ]);
  assert.deepEqual(mostCommonVotes, ['5', '8']);

  voteState(socket, participants.map((participant) => ({ ...participant, hasVoted: true })), {
    revealed: true,
    votes: { ...votes, carol: '8' },
  });
  assert.deepEqual(latest('round').results.mostCommonVotes, ['8']);
});

test('revealing an empty vote map has no most common estimate', () => {
  const { socket, latest } = votingSession();
  voteState(socket, [alice, bob], { revealed: true, votes: {} });
  assert.deepEqual(latest('round').results.mostCommonVotes, []);
  assert.deepEqual(latest('round').results.participants.map(({ value }) => value), [null, null]);
});

test('host action errors are surfaced without clearing the selected vote', () => {
  const { client, socket, latest } = votingSession();
  client.vote('5');
  voteState(socket, [{ ...alice, hasVoted: true }, bob]);
  client.reset();
  send(socket, { type: 'error', message: 'Only the host can reset votes' });
  assert.equal(latest('error').message, 'Only the host can reset votes');
  assert.equal(latest('voting').selectedVote, '5');

  client.reveal();
  client.reset();
  send(socket, { type: 'error', message: 'Rate limit exceeded' });
  assert.equal(latest('error').message, 'Rate limit exceeded');
  assert.equal(latest('voting').selectedVote, '5');
  send(socket, { type: 'error', message: 'Internal error' });
  assert.equal(latest('error').message, 'Internal error');
  assert.equal(latest('voting').selectedVote, '5');
  assert.equal(latest('round').results, null);

  client.vote('8');
  send(socket, { type: 'error', message: 'Invalid vote message' });
  assert.equal(latest('voting').selectedVote, null);
});
