(function () {
  "use strict";

  var Poker = window.PokerSession;
  var views = {
    join: document.getElementById("view-join"),
    message: document.getElementById("view-message"),
    session: document.getElementById("view-session")
  };
  var form = document.getElementById("join-form");
  var nameInput = document.getElementById("display-name");
  var nameError = document.getElementById("name-error");
  var joinButton = document.getElementById("join-button");
  var banner = document.getElementById("connection-banner");
  var noticeBanner = document.getElementById("notice-banner");
  var noticeText = document.getElementById("notice-text");
  var participantList = document.getElementById("participant-list");
  var participantCount = document.getElementById("participant-count");

  var params = new URLSearchParams(window.location.search);
  var room = params.get("room");
  var isCreator = room === null;
  var client = null;

  function show(name) {
    Object.keys(views).forEach(function (key) {
      views[key].hidden = key !== name;
    });
  }

  function showMessage(title, body, actionLabel) {
    document.getElementById("message-title").textContent = title;
    document.getElementById("message-body").textContent = body;
    var action = document.getElementById("message-action");
    action.textContent = actionLabel || "Start a new session";
    show("message");
    document.getElementById("message-title").setAttribute("tabindex", "-1");
    document.getElementById("message-title").focus();
  }

  function shareUrl() {
    var url = new URL(window.location.href);
    url.search = "?room=" + encodeURIComponent(room);
    url.hash = "";
    return url.toString();
  }

  function setBanner(text) {
    banner.hidden = !text;
    banner.textContent = text || "";
  }

  function setNotice(text) {
    noticeBanner.hidden = !text;
    noticeText.textContent = text || "";
  }

  function renderParticipants(snapshot) {
    var participants = Poker.labelParticipants(snapshot.users);
    participantList.textContent = "";
    participants.forEach(function (participant) {
      var item = document.createElement("li");
      item.className = "participant";

      var avatar = document.createElement("span");
      avatar.className = "avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent = Array.from(participant.name)[0].toUpperCase();

      var name = document.createElement("span");
      name.className = "participant-name";
      name.textContent = participant.label;

      item.appendChild(avatar);
      item.appendChild(name);

      if (participant.id === snapshot.userId) {
        item.classList.add("is-you");
        item.appendChild(badge("You", "badge-you"));
      }
      if (participant.id === snapshot.hostId) {
        item.appendChild(badge("Host", "badge-host"));
      }
      participantList.appendChild(item);
    });
    participantCount.textContent = "(" + participants.length + ")";
  }

  function badge(text, className) {
    var el = document.createElement("span");
    el.className = "badge " + className;
    el.textContent = text;
    return el;
  }

  function failureMessage(reason) {
    if (reason === "rejected") {
      return {
        title: "This session can't be joined",
        body: "The session may be full, or the link may no longer be valid. Ask the host for a fresh link, or start a new session."
      };
    }
    return {
      title: "Can't reach the server",
      body: "We couldn't connect to the planning poker service. Check your connection and try again in a moment."
    };
  }

  function join(name) {
    show("session");
    document.getElementById("share-link").value = shareUrl();
    setBanner("Connecting…");
    setNotice("");
    renderParticipants({ users: [] });

    client = new Poker.SessionClient({
      room: room,
      name: name,
      onStatus: function (status) {
        if (status === "connected") {
          setBanner("");
        } else if (status === "reconnecting") {
          setBanner("Connection lost. Reconnecting…");
        } else if (status === "connecting") {
          setBanner("Connecting…");
        }
      },
      onState: renderParticipants,
      onNotice: setNotice,
      onError: setNotice,
      onFailure: function (reason) {
        var message = failureMessage(reason);
        showMessage(message.title, message.body, reason === "unreachable" ? "Try again" : "Start a new session");
        if (reason === "unreachable") {
          document.getElementById("message-action").setAttribute("href", window.location.href);
        }
      }
    });
    client.connect();
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    var result = Poker.validateName(nameInput.value);
    if (!result.ok) {
      nameError.textContent = result.message;
      nameInput.setAttribute("aria-invalid", "true");
      nameInput.focus();
      return;
    }
    nameError.textContent = "";
    nameInput.removeAttribute("aria-invalid");

    if (isCreator) {
      room = Poker.generateRoomId();
      window.history.replaceState(null, "", "?room=" + encodeURIComponent(room));
      isCreator = false;
    }
    join(result.name);
  });

  nameInput.addEventListener("input", function () {
    nameError.textContent = "";
    nameInput.removeAttribute("aria-invalid");
  });

  document.getElementById("notice-dismiss").addEventListener("click", function () {
    setNotice("");
  });

  document.getElementById("copy-link").addEventListener("click", function () {
    var link = document.getElementById("share-link");
    var status = document.getElementById("copy-status");
    var done = function () { status.textContent = "Link copied."; };
    var fallback = function () {
      link.select();
      status.textContent = "Press Ctrl/Cmd+C to copy the selected link.";
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link.value).then(done, fallback);
    } else {
      fallback();
    }
  });

  window.addEventListener("pagehide", function () {
    if (client) {
      client.close();
    }
  });

  if (!isCreator && !Poker.isValidRoom(room)) {
    showMessage(
      "This session link isn't valid",
      "The link looks incomplete or mistyped. Ask the host to share the link again, or start a new session."
    );
  } else {
    if (!isCreator) {
      document.getElementById("join-title").textContent = "Join session";
      document.getElementById("join-intro").textContent = "Enter your display name to join the session.";
      joinButton.textContent = "Join session";
    }
    show("join");
    nameInput.focus();
  }
})();
