(function (global) {
  "use strict";

  var BACKEND_HOST = "planning-poker-backend-ymq7.onrender.com";
  var ROOM_PATTERN = /^[a-z0-9]{4,32}(-[a-z0-9]{4,32})*$/;
  var MAX_ROOM_LENGTH = 128;
  var MAX_NAME_LENGTH = 32;
  var RECONNECT_DELAY_MS = 1000;
  var SHUTDOWN_RECONNECT_DELAY_MS = 5000;
  var MAX_RECONNECT_DELAY_MS = 10000;
  var CLOSE_SERVER_SHUTDOWN = 1001;

  function isValidRoom(room) {
    return typeof room === "string" && room.length <= MAX_ROOM_LENGTH && ROOM_PATTERN.test(room);
  }

  function randomSegment(length) {
    var alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    var values = new Uint8Array(length);
    global.crypto.getRandomValues(values);
    var out = "";
    for (var i = 0; i < length; i += 1) {
      out += alphabet[values[i] % alphabet.length];
    }
    return out;
  }

  function generateRoomId() {
    return randomSegment(4) + "-" + randomSegment(4) + "-" + randomSegment(4);
  }

  function validateName(rawName) {
    var name = String(rawName || "").trim();
    if (name.length === 0) {
      return { ok: false, message: "Enter a display name to join." };
    }
    if (name.length > MAX_NAME_LENGTH) {
      return {
        ok: false,
        message: "Display names can be up to " + MAX_NAME_LENGTH + " characters. Yours is " + name.length + "."
      };
    }
    return { ok: true, name: name };
  }

  // Names are not unique, so same-named people are numbered in roster order.
  function labelParticipants(users) {
    var totals = {};
    users.forEach(function (user) {
      totals[user.name] = (totals[user.name] || 0) + 1;
    });
    var seen = {};
    return users.map(function (user) {
      seen[user.name] = (seen[user.name] || 0) + 1;
      var label = totals[user.name] > 1 ? user.name + " (" + seen[user.name] + ")" : user.name;
      return { id: user.id, name: user.name, label: label, hasVoted: Boolean(user.hasVoted) };
    });
  }

  function friendlyServerError(message) {
    if (message === "Rate limit exceeded") {
      return "You're doing that too quickly. Please wait a moment and try again.";
    }
    if (message === "Internal error") {
      return "Something went wrong on the server. Please try again.";
    }
    return message || "Something went wrong.";
  }

  // status: connecting | connected | reconnecting | closed
  // failure reasons: unreachable | rejected
  function SessionClient(options) {
    this.room = options.room;
    this.name = options.name;
    this.onStatus = options.onStatus || function () {};
    this.onState = options.onState || function () {};
    this.onNotice = options.onNotice || function () {};
    this.onError = options.onError || function () {};
    this.onFailure = options.onFailure || function () {};
    this.WebSocketImpl = options.WebSocketImpl || global.WebSocket;
    this.fetchImpl = options.fetchImpl || (global.fetch ? global.fetch.bind(global) : null);
    this.setTimer = options.setTimer || global.setTimeout.bind(global);
    this.clearTimer = options.clearTimer || global.clearTimeout.bind(global);

    this.userId = null;
    this.socket = null;
    this.timer = null;
    this.stopped = false;
    this.hasJoined = false;
    this.failedAttempts = 0;
  }

  SessionClient.prototype.url = function () {
    return "wss://" + BACKEND_HOST + "/ws?room=" + encodeURIComponent(this.room) + "&name=" + encodeURIComponent(this.name);
  };

  SessionClient.prototype.connect = function () {
    var self = this;
    var socket;
    var welcomed = false;

    this.stopped = false;
    this.onStatus(this.hasJoined ? "reconnecting" : "connecting");

    try {
      socket = new this.WebSocketImpl(this.url());
    } catch (error) {
      this.handleClose(false, 0);
      return;
    }
    this.socket = socket;

    socket.onmessage = function (event) {
      var message;
      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }
      if (message.type === "welcome") {
        welcomed = true;
        self.userId = message.userId;
        self.failedAttempts = 0;
        if (self.hasJoined) {
          self.onNotice("You rejoined as a new participant. Your previous vote was discarded, so please vote again.");
        }
        self.hasJoined = true;
        self.onStatus("connected");
      } else if (message.type === "state") {
        self.onState({
          hostId: message.hostId,
          revealed: Boolean(message.revealed),
          deck: message.deck,
          users: Array.isArray(message.users) ? message.users : [],
          votes: message.votes || null,
          userId: self.userId
        });
      } else if (message.type === "error") {
        self.onError(friendlyServerError(message.message));
      }
    };

    socket.onclose = function (event) {
      if (self.socket !== socket) {
        return;
      }
      self.handleClose(welcomed, event && event.code);
    };
  };

  SessionClient.prototype.handleClose = function (welcomed, code) {
    var self = this;
    this.socket = null;
    if (this.stopped) {
      return;
    }

    if (!this.hasJoined) {
      this.probeBackend().then(function (reachable) {
        if (!self.stopped) {
          self.onStatus("closed");
          self.onFailure(reachable ? "rejected" : "unreachable");
        }
      });
      return;
    }

    this.failedAttempts = welcomed ? 0 : this.failedAttempts + 1;
    var delay = code === CLOSE_SERVER_SHUTDOWN
      ? SHUTDOWN_RECONNECT_DELAY_MS
      : Math.min(RECONNECT_DELAY_MS * Math.pow(2, this.failedAttempts), MAX_RECONNECT_DELAY_MS);
    this.onStatus("reconnecting");
    this.timer = this.setTimer(function () {
      self.timer = null;
      self.connect();
    }, delay);
  };

  // A refused upgrade is invisible to the browser, so check whether the server answers at all.
  SessionClient.prototype.probeBackend = function () {
    if (!this.fetchImpl) {
      return Promise.resolve(false);
    }
    return this.fetchImpl("https://" + BACKEND_HOST + "/health", { mode: "no-cors", cache: "no-store" }).then(
      function () { return true; },
      function () { return false; }
    );
  };

  SessionClient.prototype.close = function () {
    this.stopped = true;
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    if (this.socket) {
      var socket = this.socket;
      this.socket = null;
      socket.close();
    }
  };

  global.PokerSession = {
    SessionClient: SessionClient,
    isValidRoom: isValidRoom,
    generateRoomId: generateRoomId,
    validateName: validateName,
    labelParticipants: labelParticipants,
    MAX_NAME_LENGTH: MAX_NAME_LENGTH
  };
})(window);
