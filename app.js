/**
 * Planning Poker — join flow (issue #15: "Join a session and see who is
 * present"). Plain script (no modules, no bundler) so it works both as a
 * browser <script src="app.js"> over file:// and as a Node `require()` target
 * for the test suite — see docs/api-contract.md for the backend protocol.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.PlanningPoker = factory();
  }
})(typeof window !== "undefined" ? window : globalThis, function () {
  "use strict";

  var WS_BASE_URL = "wss://planning-poker-backend-ymq7.onrender.com/ws";
  var ROOM_ID_PATTERN = /^[a-z0-9]{4,32}(-[a-z0-9]{4,32})*$/;
  var NAME_MAX_LENGTH = 32;
  // Technical Notes: "short delay... after a server shutdown close" (code 1001).
  var RECONNECT_DELAY_MS = 800;
  var RECONNECT_DELAY_AFTER_SHUTDOWN_MS = 3000;
  var SERVER_SHUTDOWN_CLOSE_CODE = 1001;

  // ---- Room id -------------------------------------------------------

  /** Generates a room id matching the backend's required slug format. */
  function generateRoomId() {
    return [randomSegment(4), randomSegment(4)].join("-");
  }

  function randomSegment(length) {
    var chars = "abcdefghijklmnopqrstuvwxyz0123456789";
    var out = "";
    for (var i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  /** Whether `id` matches the backend's room id validation regex. */
  function isValidRoomId(id) {
    return typeof id === "string" && ROOM_ID_PATTERN.test(id);
  }

  /** Reads `?room=` from a location.search string, or null if absent/blank. */
  function getRoomIdFromSearch(search) {
    var params = new URLSearchParams(search || "");
    var room = params.get("room");
    return room && room.length > 0 ? room : null;
  }

  /** Builds the shareable join link for a room, e.g. for copy-to-clipboard. */
  function buildShareUrl(roomId, origin, pathname) {
    return origin + pathname + "?room=" + encodeURIComponent(roomId);
  }

  // ---- Display name ---------------------------------------------------

  /**
   * Validates a display name per Technical Notes: "Validate the display name
   * length (1-32 characters after trimming) before connecting."
   * Returns { valid: true, name } or { valid: false, error }.
   */
  function validateDisplayName(raw) {
    var trimmed = (raw || "").trim();
    if (trimmed.length < 1) {
      return { valid: false, error: "Enter a display name to join." };
    }
    if (trimmed.length > NAME_MAX_LENGTH) {
      return {
        valid: false,
        error: "Display name must be " + NAME_MAX_LENGTH + " characters or fewer.",
      };
    }
    return { valid: true, name: trimmed };
  }

  // ---- WebSocket URL ----------------------------------------------------

  function buildSocketUrl(roomId, name, deck) {
    var params = new URLSearchParams();
    params.set("room", roomId);
    params.set("name", name);
    if (deck) {
      params.set("deck", deck);
    }
    return WS_BASE_URL + "?" + params.toString();
  }

  // ---- Roster rendering -------------------------------------------------

  /**
   * Maps each user to a display label, disambiguating participants who share
   * the same name (AC06) by suffixing repeats in join order: "Alice",
   * "Alice (2)", "Alice (3)", ...
   */
  function computeDisplayNames(users) {
    var seen = Object.create(null);
    var labels = {};
    (users || []).forEach(function (user) {
      var count = (seen[user.name] || 0) + 1;
      seen[user.name] = count;
      labels[user.id] = count === 1 ? user.name : user.name + " (" + count + ")";
    });
    return labels;
  }

  /**
   * Builds the view-model rows for the participant list: display label plus
   * whether the row is the current user and/or the host (AC05).
   */
  function computeRoster(users, hostId, ownId) {
    var labels = computeDisplayNames(users);
    return (users || []).map(function (user) {
      return {
        id: user.id,
        label: labels[user.id],
        hasVoted: !!user.hasVoted,
        isYou: user.id === ownId,
        isHost: user.id === hostId,
      };
    });
  }

  // ---- Disconnect handling ----------------------------------------------

  /**
   * Decides what a closed connection means for the UI.
   * - Never received `welcome`: the join itself failed. The frontend already
   *   rejects malformed room ids before connecting (AC07), so a connection
   *   failure during an actual attempt means the only state the backend can
   *   reject on is capacity — surfaced as "room full" (AC08).
   * - Received `welcome` already (was an active participant): the connection
   *   was lost after joining, so reconnect automatically (AC09/AC10).
   */
  function classifyDisconnect(hadWelcome) {
    return hadWelcome ? "reconnecting" : "join-failed";
  }

  /** Delay before auto-reconnecting; longer right after a server shutdown. */
  function reconnectDelayMs(closeCode) {
    return closeCode === SERVER_SHUTDOWN_CLOSE_CODE
      ? RECONNECT_DELAY_AFTER_SHUTDOWN_MS
      : RECONNECT_DELAY_MS;
  }

  var api = {
    WS_BASE_URL: WS_BASE_URL,
    NAME_MAX_LENGTH: NAME_MAX_LENGTH,
    SERVER_SHUTDOWN_CLOSE_CODE: SERVER_SHUTDOWN_CLOSE_CODE,
    generateRoomId: generateRoomId,
    isValidRoomId: isValidRoomId,
    getRoomIdFromSearch: getRoomIdFromSearch,
    buildShareUrl: buildShareUrl,
    validateDisplayName: validateDisplayName,
    buildSocketUrl: buildSocketUrl,
    computeDisplayNames: computeDisplayNames,
    computeRoster: computeRoster,
    classifyDisconnect: classifyDisconnect,
    reconnectDelayMs: reconnectDelayMs,
  };

  // ---- Browser wiring (skipped under Node/test) -------------------------

  if (typeof document !== "undefined") {
    initApp(api);
  }

  return api;

  function initApp(api) {
    var els = {
      startScreen: document.getElementById("start-screen"),
      joinScreen: document.getElementById("join-screen"),
      sessionScreen: document.getElementById("session-screen"),
      invalidLinkScreen: document.getElementById("invalid-link-screen"),
      startButton: document.getElementById("start-session"),
      joinForm: document.getElementById("join-form"),
      nameInput: document.getElementById("display-name"),
      joinError: document.getElementById("join-error"),
      joinShareLink: document.getElementById("join-share-link"),
      sessionShareLink: document.getElementById("session-share-link"),
      connectionBanner: document.getElementById("connection-banner"),
      rejoinBanner: document.getElementById("rejoin-banner"),
      roster: document.getElementById("participant-list"),
    };

    if (!els.startScreen) {
      return; // session-app markup isn't present on this page
    }

    var screens = [
      els.startScreen,
      els.joinScreen,
      els.sessionScreen,
      els.invalidLinkScreen,
    ];

    function showScreen(screen) {
      screens.forEach(function (el) {
        if (el) el.hidden = el !== screen;
      });
    }

    var state = {
      roomId: null,
      name: null,
      socket: null,
      ownId: null,
      hadWelcome: false,
      reconnecting: false,
      reconnectedOnce: false,
    };

    var roomIdFromUrl = api.getRoomIdFromSearch(window.location.search);

    if (roomIdFromUrl === null) {
      showScreen(els.startScreen);
    } else if (!api.isValidRoomId(roomIdFromUrl)) {
      showScreen(els.invalidLinkScreen); // AC07
    } else {
      state.roomId = roomIdFromUrl;
      showScreen(els.joinScreen);
    }

    if (els.startButton) {
      els.startButton.addEventListener("click", function () {
        state.roomId = api.generateRoomId();
        var shareUrl = api.buildShareUrl(
          state.roomId,
          window.location.origin,
          window.location.pathname,
        );
        window.history.replaceState(null, "", "?room=" + state.roomId);
        if (els.joinShareLink) els.joinShareLink.textContent = shareUrl;
        showScreen(els.joinScreen);
      });
    }

    if (els.joinForm) {
      els.joinForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var result = api.validateDisplayName(els.nameInput.value);
        if (!result.valid) {
          els.joinError.textContent = result.error; // AC03
          els.joinError.hidden = false;
          return;
        }
        els.joinError.hidden = true;
        state.name = result.name;
        connect();
      });
    }

    function connect() {
      state.hadWelcome = false;
      var socket = new WebSocket(api.buildSocketUrl(state.roomId, state.name));
      state.socket = socket;

      socket.addEventListener("message", function (event) {
        var message = JSON.parse(event.data);
        if (message.type === "welcome") {
          onWelcome(message);
        } else if (message.type === "state") {
          onState(message);
        }
      });

      socket.addEventListener("close", function (event) {
        onClose(event.code);
      });
    }

    function onWelcome(message) {
      var wasReconnect = state.reconnecting;
      state.ownId = message.userId;
      state.hadWelcome = true;
      state.reconnecting = false;
      if (els.connectionBanner) els.connectionBanner.hidden = true;

      var shareUrl = api.buildShareUrl(
        state.roomId,
        window.location.origin,
        window.location.pathname,
      );
      if (els.sessionShareLink) els.sessionShareLink.textContent = shareUrl;
      showScreen(els.sessionScreen);

      if (wasReconnect && els.rejoinBanner) {
        // AC10: rejoining after a dropped connection is a new participant.
        els.rejoinBanner.hidden = false;
        state.reconnectedOnce = true;
      }
    }

    function onState(message) {
      var rows = api.computeRoster(message.users, message.hostId, state.ownId);
      renderRoster(rows);
    }

    function renderRoster(rows) {
      if (!els.roster) return;
      els.roster.innerHTML = "";
      rows.forEach(function (row) {
        var li = document.createElement("li");
        li.textContent = row.label;
        if (row.isYou) li.textContent += " (you)";
        if (row.isHost) li.textContent += " — host";
        els.roster.appendChild(li);
      });
    }

    function onClose(code) {
      var outcome = api.classifyDisconnect(state.hadWelcome);
      if (outcome === "join-failed") {
        els.joinError.textContent =
          "Couldn't join this session — it may be full. Please try again."; // AC08
        els.joinError.hidden = false;
        return;
      }

      // AC09: show a visible reconnecting state and retry automatically.
      state.reconnecting = true;
      state.hadWelcome = false;
      if (els.connectionBanner) {
        els.connectionBanner.textContent = "Reconnecting…";
        els.connectionBanner.hidden = false;
      }
      setTimeout(connect, api.reconnectDelayMs(code));
    }
  }
});
