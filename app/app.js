// DOM wiring for the join/start-session screen. Not unit tested; the logic it
// calls into (room, display-name, roster, session-client, etc.) is.
import { generateRoomId, isValidRoomId } from './room.js';
import { parseRoomFromUrl, buildShareableLink } from './room-link.js';
import { validateDisplayName } from './display-name.js';
import { createSessionClient } from './session-client.js';

const WS_BASE_URL = 'wss://planning-poker-backend-ymq7.onrender.com/ws';

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
      <ul class="roster" data-testid="roster"></ul>
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

function renderRoster(roster) {
  const list = root.querySelector('[data-testid="roster"]');
  if (!list) {
    return;
  }
  list.innerHTML = roster
    .map((participant) => `<li class="${participant.isMe ? 'me' : ''}">${participant.displayLabel}${participant.isHost ? ' — host' : ''}</li>`)
    .join('');
}

function joinSession({ roomId, name, isStarting }) {
  showSession({ roomId, isStarting });

  createSessionClient({
    url: buildWsUrl(roomId, name),
    roomId,
    onStatusChange(status, payload) {
      if (status === 'connecting') {
        renderStatus('Connecting…');
      } else if (status === 'reconnecting') {
        renderStatus('Reconnecting…');
      } else if (status === 'joined') {
        renderStatus('Connected');
        renderRejoinNotice(payload.outcomeMessage);
      } else if (status === 'roster') {
        renderRoster(payload.roster);
      } else if (status === 'failed') {
        showFailure(payload.message);
      } else if (status === 'error') {
        renderStatus(payload.message);
      }
    },
  });
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
