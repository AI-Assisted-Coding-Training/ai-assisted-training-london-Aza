import { generateRoomId, isValidRoomId } from './room.js';
import { parseRoomFromUrl, buildShareableLink } from './room-link.js';
import { validateDisplayName } from './display-name.js';
import { createSessionClient } from './session-client.js';

const WS_BASE_URL = 'wss://planning-poker-backend-ymq7.onrender.com/ws';
const VOTE_CARDS = ['0', '1', '2', '3', '5', '8', '13', '21'];

const root = document.querySelector('[data-testid="app-root"]');

function render(html) {
  root.innerHTML = html;
}

function buildWsUrl(roomId, name) {
  const url = new URL(WS_BASE_URL);
  url.searchParams.set('room', roomId);
  url.searchParams.set('name', name);
  return url.toString();
}

function showFailure(message) {
  render(`
    <main>
      <h1>Planning Poker</h1>
      <p class="failure" data-testid="join-failure">${message}</p>
    </main>
  `);
}

function showEntryForm({ roomId, isStarting }) {
  render(`
    <main>
      <h1>Planning Poker</h1>
      <form data-testid="entry-form">
        <label for="display-name">${isStarting ? 'Start a session' : 'Join this session'}</label>
        <input id="display-name" name="displayName" type="text" maxlength="40" autocomplete="off" placeholder="Your display name">
        <p class="field-error" data-testid="name-error" hidden></p>
        <button type="submit">${isStarting ? 'Start session' : 'Join session'}</button>
      </form>
    </main>
  `);

  const form = root.querySelector('[data-testid="entry-form"]');
  const nameError = root.querySelector('[data-testid="name-error"]');

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawName = new FormData(form).get('displayName');
    const result = validateDisplayName(rawName);
    if (!result.valid) {
      nameError.hidden = false;
      nameError.textContent = result.message;
      return;
    }
    joinSession({ roomId, name: result.trimmedName, isStarting });
  });
}

function showSession({ roomId, isStarting }) {
  render(`
    <main>
      <h1>Planning Poker</h1>
      <p class="status" data-testid="status">Connecting…</p>
      <p class="notice" data-testid="rejoin-notice" hidden></p>
      <div class="share" data-testid="share-link" hidden>
        <label for="share-link-input">Share this link to invite your team</label>
        <input id="share-link-input" type="text" readonly>
      </div>
      <section aria-labelledby="vote-heading">
        <h2 id="vote-heading">Your estimate</h2>
        <div class="vote-cards">
          ${VOTE_CARDS.map((value) => `<button type="button" class="vote-card" data-vote="${value}" aria-pressed="false" disabled>${value}</button>`).join('')}
        </div>
        <p class="status" data-testid="vote-lock" role="status"></p>
        <div class="round-controls" data-testid="round-controls" hidden>
          <button type="button" data-testid="reveal-votes">Reveal votes</button>
          <button type="button" data-testid="reset-votes">Start new round</button>
        </div>
        <p class="action-error" data-testid="action-error" role="alert"></p>
      </section>
      <section aria-labelledby="roster-heading" data-testid="roster-section">
        <h2 id="roster-heading">Participants</h2>
        <p class="status" data-testid="voting-progress" role="status"></p>
        <ul class="roster" data-testid="roster"></ul>
      </section>
      <section aria-labelledby="results-heading" data-testid="results-section" hidden>
        <h2 id="results-heading">Results</h2>
        <p class="status" data-testid="results-summary" role="status"></p>
        <ul class="roster" data-testid="results"></ul>
      </section>
    </main>
  `);

  if (isStarting) {
    const shareBox = root.querySelector('[data-testid="share-link"]');
    const shareInput = root.querySelector('#share-link-input');
    shareInput.value = buildShareableLink(window.location.href.split('?')[0], roomId);
    shareBox.hidden = false;
  }
}

function renderStatus(message) {
  const status = root.querySelector('[data-testid="status"]');
  if (status) {
    status.textContent = message;
  }
}

function renderRejoinNotice(message) {
  const notice = root.querySelector('[data-testid="rejoin-notice"]');
  if (!notice) {
    return;
  }
  notice.hidden = !message;
  notice.textContent = message ?? '';
}

function renderParticipantList(list, participants, detailFor) {
  list.replaceChildren(...participants.map((participant) => {
    const item = document.createElement('li');
    const label = document.createElement('span');
    const detail = document.createElement('span');
    item.classList.toggle('me', participant.isMe);
    label.textContent = participant.displayLabel + (participant.isHost ? ' — host' : '');
    detail.className = 'participant-detail';
    detail.textContent = detailFor(participant);
    item.append(label, detail);
    return item;
  }));
}

function renderRoster({ roster, votedCount }) {
  const list = root.querySelector('[data-testid="roster"]');
  renderParticipantList(list, roster, (participant) => participant.hasVoted ? 'Voted' : 'Not voted');
  const progress = root.querySelector('[data-testid="voting-progress"]');
  const text = `${votedCount} of ${roster.length} voted`;
  if (progress.textContent !== text) {
    progress.textContent = text;
  }
}

function renderVoting({ canVote, revealed, selectedVote }) {
  for (const card of root.querySelectorAll('[data-vote]')) {
    card.disabled = !canVote;
    card.setAttribute('aria-pressed', String(card.dataset.vote === selectedVote));
  }
  const lock = root.querySelector('[data-testid="vote-lock"]');
  const text = revealed ? 'Voting is locked until the next round.' : '';
  if (lock.textContent !== text) {
    lock.textContent = text;
  }
}

function renderRound({ canManageRound, results }) {
  root.querySelector('[data-testid="round-controls"]').hidden = !canManageRound;
  root.querySelector('[data-testid="roster-section"]').hidden = results !== null;
  root.querySelector('[data-testid="results-section"]').hidden = results === null;
  const summary = root.querySelector('[data-testid="results-summary"]');
  const list = root.querySelector('[data-testid="results"]');
  if (results === null) {
    summary.textContent = '';
    list.replaceChildren();
    return;
  }

  const { participants, mostCommonVotes } = results;
  let text = 'No votes were cast.';
  if (mostCommonVotes.length > 0) {
    const label = mostCommonVotes.length === 1 ? 'Most common estimate' : 'Most common estimates';
    text = `${label}: ${mostCommonVotes.join(', ')}`;
  }
  if (summary.textContent !== text) {
    summary.textContent = text;
  }
  renderParticipantList(list, participants, (participant) => participant.value ?? 'Did not vote');
}

function joinSession({ roomId, name, isStarting }) {
  showSession({ roomId, isStarting });
  const actionError = root.querySelector('[data-testid="action-error"]');

  const client = createSessionClient({
    url: buildWsUrl(roomId, name),
    roomId,
    onStatusChange(status, payload) {
      if (status === 'connecting') {
        renderStatus('Connecting…');
      } else if (status === 'reconnecting') {
        renderStatus('Reconnecting…');
        actionError.textContent = '';
      } else if (status === 'joined') {
        renderStatus('Connected');
        renderRejoinNotice(payload.outcomeMessage);
      } else if (status === 'roster') {
        renderRoster(payload);
      } else if (status === 'voting') {
        renderVoting(payload);
      } else if (status === 'round') {
        renderRound(payload);
      } else if (status === 'failed') {
        showFailure(payload.message);
      } else if (status === 'error') {
        actionError.textContent = payload.message;
      }
    },
  });

  function onAction(button, action) {
    button?.addEventListener('click', () => {
      actionError.textContent = '';
      action();
    });
  }
  for (const card of root.querySelectorAll('[data-vote]')) {
    onAction(card, () => client.vote(card.dataset.vote));
  }
  onAction(root.querySelector('[data-testid="reveal-votes"]'), client.reveal);
  onAction(root.querySelector('[data-testid="reset-votes"]'), client.reset);
}

function init() {
  const roomId = parseRoomFromUrl(window.location.href);

  if (roomId && !isValidRoomId(roomId)) {
    showFailure('This session link is invalid.');
    return;
  }

  if (roomId) {
    showEntryForm({ roomId, isStarting: false });
  } else {
    showEntryForm({ roomId: generateRoomId(), isStarting: true });
  }
}

init();
