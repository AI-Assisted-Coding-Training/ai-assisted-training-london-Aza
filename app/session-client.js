import { isValidRoomId } from './room.js';
import { buildRoster } from './roster.js';
import { reconnectDelayMs } from './reconnect.js';
import { describeJoinOutcome } from './join-outcome.js';
import { describeJoinFailure } from './join-failure.js';

const hostActionErrors = new Map([
  ['Invalid reveal message', 'reveal'],
  ['Only the host can reveal votes', 'reveal'],
  ['Votes are already revealed', 'reveal'],
  ['Invalid reset message', 'reset'],
  ['Only the host can reset votes', 'reset'],
  ['Votes are already reset', 'reset'],
]);

function buildResults(roster, votes) {
  const counts = new Map();
  const participants = roster.map((participant) => {
    const value = Object.hasOwn(votes, participant.id) ? votes[participant.id] : null;
    if (value !== null) {
      counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    return { ...participant, value };
  });
  const maxCount = Math.max(0, ...counts.values());
  const mostCommonVotes = [...counts.keys()].filter((value) => counts.get(value) === maxCount);
  return { participants, mostCommonVotes };
}

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
  let isHost = false;
  let revealed = false;
  let hasVoted = false;
  let votedCount = 0;
  let selectedVote = null;
  const pendingHostActions = [];

  function emit(status, payload) {
    onStatusChange?.(status, payload);
  }

  function isConnected() {
    return !manuallyClosed && hasSnapshot && socket.readyState === WebSocketImpl.OPEN;
  }

  function canVote() {
    return isConnected() && !revealed;
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

  function sendHostAction(type) {
    if (!isConnected() || !isHost) {
      emit('error', { message: 'Only the connected host can manage the round.' });
      return;
    }
    socket.send(JSON.stringify({ type }));
    pendingHostActions.push(type);
  }

  function finishHostAction(type) {
    const index = pendingHostActions.indexOf(type);
    if (index !== -1) {
      pendingHostActions.splice(index, 1);
    }
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
        const nextRevealed = message.revealed === true;
        const nextHasVoted = roster.find((participant) => participant.isMe)?.hasVoted === true;
        const nextVotedCount = roster.filter((participant) => participant.hasVoted).length;
        if (!revealed && nextRevealed) {
          finishHostAction('reveal');
        }
        if (!nextRevealed && nextVotedCount === 0 && (revealed || votedCount > 0)) {
          finishHostAction('reset');
        }
        // A revealed round reopened or our confirmed vote was reset.
        if ((revealed && !nextRevealed) || (hasVoted && !nextHasVoted)) {
          selectedVote = null;
        }
        hasSnapshot = true;
        isHost = ownUserId === message.hostId;
        revealed = nextRevealed;
        hasVoted = nextHasVoted;
        votedCount = nextVotedCount;
        emit('roster', { roster, votedCount });
        emitVoting();
        emit('round', {
          canManageRound: isConnected() && isHost,
          results: revealed ? buildResults(roster, message.votes) : null,
        });
        return;
      }

      if (message.type === 'error') {
        const hostAction = hostActionErrors.get(message.message);
        const voteError = message.message === 'Invalid vote message' || message.message === 'Voting is locked until reset';
        if (hostAction) {
          finishHostAction(hostAction);
        } else if (voteError || pendingHostActions.length === 0) {
          selectedVote = null;
          emitVoting();
        } else {
          // Generic errors have no request ID. Keep the selection if a host action may have failed.
          pendingHostActions.shift();
        }
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
      isHost = false;
      revealed = false;
      hasVoted = false;
      votedCount = 0;
      selectedVote = null;
      pendingHostActions.length = 0;
      emitVoting();
      emit('round', { canManageRound: false, results: null });
      emit('reconnecting');
      scheduleReconnect(connect, reconnectDelayMs(event.code));
    };
  }

  function close() {
    manuallyClosed = true;
    socket?.close();
  }

  connect();

  return {
    close,
    vote,
    reveal: () => sendHostAction('reveal'),
    reset: () => sendHostAction('reset'),
  };
}
