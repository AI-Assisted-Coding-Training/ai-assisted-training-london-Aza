// Wires the WebSocket connection to the pure join/roster/reconnect helpers.
// Statuses emitted via onStatusChange: 'connecting', 'joined', 'roster',
// 'reconnecting', 'error', 'failed'.
import { isValidRoomId } from './room.js';
import { buildRoster } from './roster.js';
import { reconnectDelayMs } from './reconnect.js';
import { describeJoinOutcome } from './join-outcome.js';
import { describeJoinFailure } from './join-failure.js';

export function createSessionClient({
  url,
  roomId,
  WebSocketImpl = globalThis.WebSocket,
  scheduleReconnect = (fn, delay) => setTimeout(fn, delay),
  onStatusChange,
}) {
  let socket = null;
  let ownUserId = null;
  let hasJoinedBefore = false;
  let manuallyClosed = false;

  function emit(status, payload) {
    onStatusChange?.(status, payload);
  }

  function connect() {
    if (!isValidRoomId(roomId)) {
      emit('failed', { message: describeJoinFailure(roomId) });
      return;
    }

    if (!hasJoinedBefore) {
      emit('connecting');
    }

    socket = new WebSocketImpl(url);

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'welcome') {
        const isReconnect = hasJoinedBefore;
        ownUserId = message.userId;
        hasJoinedBefore = true;
        emit('joined', { outcomeMessage: describeJoinOutcome({ isReconnect }) });
        return;
      }

      if (message.type === 'state') {
        emit('roster', { roster: buildRoster(ownUserId, message) });
        return;
      }

      if (message.type === 'error') {
        emit('error', { message: message.message });
      }
    };

    socket.onclose = (event) => {
      if (manuallyClosed) {
        return;
      }
      if (!hasJoinedBefore) {
        emit('failed', { message: describeJoinFailure(roomId) });
        return;
      }
      emit('reconnecting');
      scheduleReconnect(connect, reconnectDelayMs(event.code));
    };
  }

  function close() {
    manuallyClosed = true;
    socket?.close();
  }

  connect();

  return { close };
}
