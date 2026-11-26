import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionClient } from '../app/session-client.js';

// Minimal hand-rolled WebSocket fake, used only in tests (no new dependency).
class FakeWebSocket {
  constructor(url) {
    this.url = url;
    FakeWebSocket.instances.push(this);
  }
  close() {
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
