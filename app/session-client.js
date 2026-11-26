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
  let hasSnapshot = false;
  let revealed = false;
  let hasVoted = false;
  let selectedVote = null;

  function emit(status, payload) {
    onStatusChange?.(status, payload);
  }

  function canVote() {
    return !manuallyClosed && hasSnapshot && !revealed && socket.readyState === WebSocketImpl.OPEN;
  }

  function emitVoting() {
    emit('voting', { canVote: canVote(), revealed, selectedVote });
  }

  function vote(value) {
    if (!canVote()) {
      emit('error', { message: revealed ? 'Voting is locked until the next round.' : 'Voting is unavailable until you are connected.' });
      return;
    }
    if (typeof value !== 'string') {
      emit('error', { message: 'Choose a valid estimate.' });
      return;
    }
    socket.send(JSON.stringify({ type: 'vote', value }));
    selectedVote = value;
    emitVoting();
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
        const roster = buildRoster(ownUserId, message);
        const nextHasVoted = roster.find((participant) => participant.isMe)?.hasVoted === true;
        // A revealed round reopened or our confirmed vote was reset.
        if ((revealed && !message.revealed) || (hasVoted && !nextHasVoted)) {
          selectedVote = null;
        }
        hasSnapshot = true;
        revealed = message.revealed === true;
        hasVoted = nextHasVoted;
        emit('roster', { roster, votedCount: roster.filter((participant) => participant.hasVoted).length });
        emitVoting();
        return;
      }

      if (message.type === 'error') {
        // Voting is the only action this client sends; errors have no request ID.
        selectedVote = null;
        emitVoting();
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
      hasSnapshot = false;
      revealed = false;
      hasVoted = false;
      selectedVote = null;
      emitVoting();
      emit('reconnecting');
      scheduleReconnect(connect, reconnectDelayMs(event.code));
    };
  }

  function close() {
    manuallyClosed = true;
    socket?.close();
  }

  connect();

  return { close, vote };
}
